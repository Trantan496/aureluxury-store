import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { normalizeTryOnClothType } from "@/features/tryon/cloth-type";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PERSON_IMAGE_BYTES = 10 * 1024 * 1024;
const TRYON_TIMEOUT_MS = 90_000;

function getTryOnServiceUrl(): string {
  const raw = process.env.TRYON_SERVICE_URL?.trim() || "http://127.0.0.1:8001";
  return raw.replace(/\/+$/, "");
}

async function resolveGarmentBytes(garmentUrl: string): Promise<{ bytes: Uint8Array; mime: string; filename: string }> {
  const trimmed = garmentUrl.trim();
  if (!trimmed) {
    throw new Error("EMPTY_GARMENT_URL");
  }

  if (trimmed.startsWith("/")) {
    const cleanPath = trimmed.split("?")[0];
    if (cleanPath.startsWith("/images/uploads/")) {
      const [{ prisma }, { imageAssetId, readPublishedImage }] = await Promise.all([
        import("@/lib/db/client"),
        import("@/features/products/image-storage"),
      ]);
      const id = imageAssetId(cleanPath);
      if (!id) {
        throw new Error("INVALID_GARMENT_PATH");
      }
      const published = await readPublishedImage(prisma, cleanPath);
      if (!published) {
        throw new Error("GARMENT_NOT_FOUND");
      }
      return {
        bytes: new Uint8Array(published),
        mime: "image/webp",
        filename: `${id}.webp`,
      };
    }

    const cleanRel = cleanPath.replace(/^\/+/, "");
    const publicRoot = path.resolve(process.cwd(), "public");
    const resolved = path.resolve(publicRoot, cleanRel);
    if (!resolved.startsWith(publicRoot + path.sep)) {
      throw new Error("INVALID_GARMENT_PATH");
    }
    const buf = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { bytes: new Uint8Array(buf), mime, filename: path.basename(resolved) || "garment.png" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("INVALID_GARMENT_URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("INVALID_GARMENT_URL");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1") {
    throw new Error("INVALID_GARMENT_URL");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(parsed.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new Error("GARMENT_FETCH_FAILED");
    }
    const arr = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return { bytes: arr, mime, filename: "garment.png" };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${getTryOnServiceUrl()}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    return NextResponse.json(payload ?? { status: res.ok ? "ready" : "unavailable" }, {
      status: res.status,
    });
  } catch {
    return NextResponse.json(
      {
        status: "offline",
        model: "CatVTON",
        error: "Dịch vụ AI cục bộ chưa khởi động trên cổng 8001.",
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu tải lên không hợp lệ." }, { status: 400 });
  }

  const personFile = formData.get("personImage");
  const garmentFile = formData.get("garmentImage");
  const garmentUrl = formData.get("garmentImageUrl");
  const clothType = normalizeTryOnClothType(formData.get("clothType") ?? formData.get("cloth_type"));

  if (!(personFile instanceof File) || personFile.size === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ảnh toàn thân của bạn." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(personFile.type)) {
    return NextResponse.json({ error: "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP." }, { status: 400 });
  }
  if (personFile.size > MAX_PERSON_IMAGE_BYTES) {
    return NextResponse.json({ error: "Ảnh tải lên vượt quá giới hạn 10 MB." }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("person_image", personFile, personFile.name || "person.png");
  upstreamForm.append("cloth_type", clothType);

  if (garmentFile instanceof File && garmentFile.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(garmentFile.type)) {
      return NextResponse.json({ error: "Ảnh trang phục chỉ hỗ trợ JPG, PNG hoặc WebP." }, { status: 400 });
    }
    if (garmentFile.size > MAX_PERSON_IMAGE_BYTES) {
      return NextResponse.json({ error: "Ảnh trang phục vượt quá giới hạn 10 MB." }, { status: 400 });
    }
    upstreamForm.append("garment_image", garmentFile, garmentFile.name || "garment.png");
  } else if (typeof garmentUrl === "string" && garmentUrl.trim()) {
    let garment: { bytes: Uint8Array; mime: string; filename: string };
    try {
      garment = await resolveGarmentBytes(garmentUrl);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      const status = code === "GARMENT_FETCH_FAILED" ? 502 : 400;
      return NextResponse.json({ error: "Không thể đọc ảnh trang phục của sản phẩm." }, { status });
    }
    upstreamForm.append(
      "garment_image",
      new Blob([Buffer.from(garment.bytes)], { type: garment.mime }),
      garment.filename
    );
  } else {
    return NextResponse.json({ error: "Không tìm thấy ảnh sản phẩm để thử đồ." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRYON_TIMEOUT_MS);

  try {
    const upstreamRes = await fetch(`${getTryOnServiceUrl()}/try-on`, {
      method: "POST",
      body: upstreamForm,
      signal: controller.signal,
    });

    const payload = await upstreamRes.json().catch(() => null);

    if (!upstreamRes.ok) {
      const detail =
        payload && typeof payload.detail === "string"
          ? payload.detail
          : "Dịch vụ AI Virtual Try-On đang gặp sự cố.";
      const status = upstreamRes.status >= 400 && upstreamRes.status < 600 ? upstreamRes.status : 502;
      return NextResponse.json({ error: detail }, { status });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Quá thời gian xử lý AI Virtual Try-On. Vui lòng thử lại." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Dịch vụ AI Virtual Try-On cục bộ (CatVTON) chưa được khởi động hoặc không thể kết nối.",
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(timer);
  }
}
