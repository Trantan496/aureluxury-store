import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createProductDataService } from "@/lib/products";
import { assertAdminOrigin, readAdminJson } from "@/features/products/admin-http";
import { object } from "@/features/products/validation";
import { importColumns } from "@/features/products/import-dry-run";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
function response(result: { ok: boolean; error?: { code: string } }) {
  const status = result.ok ? 200 : ({ UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, INVALID_INPUT: 400, CONFLICT: 409, FEATURE_UNAVAILABLE: 503 } as Record<string, number>)[result.error?.code ?? ""] ?? 503;
  return NextResponse.json(result, { status, headers });
}
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams, service = createProductDataService();
  const operation = query.get("operation");
  if (operation === "taxonomy") return response(await service.managementTaxonomy());
  if (operation === "get") return response(await service.managementGet(Number(query.get("id"))));
  if (operation === "export") {
    const result = await service.managementExport({ page: Number(query.get("page") ?? 1) });
    if (!result.ok) return response(result);
    const table = query.get("table");
    if (table && Object.hasOwn(importColumns, table)) return new Response(result.data.files[table], { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${table}-page-${result.data.page}.csv"` } });
    return response(result);
  }
  return response(await service.managementList({ q: query.get("q") ?? "", page: Number(query.get("page") ?? 1), status: query.get("status") ?? "all", ...(query.get("category") ? { category: Number(query.get("category")) } : {}), ...(query.get("collection") ? { collection: query.get("collection") } : {}) }));
}
export async function POST(request: Request) {
  try {
    assertAdminOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL, request.headers.get("sec-fetch-site"));
    const value = object(await readAdminJson(request), ["operation", "input", "id", "imageId", "version", "confirmation", "files", "active", "requestKey"]);
    const service = createProductDataService();
    switch (value.operation) {
      case "prepare": {
        const result = await service.managementPrepare(value.input, value.id, value.version, value.requestKey);
        if (result.ok) { revalidatePath(`/products/${result.data.slug}`); revalidatePath("/products"); revalidatePath("/"); }
        return response(result);
      }
      case "finalize": {
        const result = await service.managementFinalize(value.id, value.version, value.input);
        if (result.ok) { revalidatePath(`/products/${result.data.slug}`); revalidatePath("/products"); revalidatePath("/"); }
        return response(result);
      }
      case "get": return response(await service.managementGet(value.id));
      case "variant-expand": {
        const result=await service.managementExpandVariants(value.id,value.version,value.input);
        if(result.ok){revalidatePath(`/products/${result.data.slug}`);revalidatePath("/products");}
        return response(result);
      }
      case "save": return response(await service.managementSave(value.input, value.id, value.version));
      case "status": return response(await service.managementStatus(value.id, value.version, value.active));
      case "delete": {
        const result = await service.managementDelete(value.id, value.version, value.confirmation);
        if (result.ok) {
          revalidatePath(`/products/${result.data.slug}`);
          revalidatePath("/products");
          revalidatePath("/");
          revalidatePath("/admin/products");
        }
        return response(result);
      }
      case "remove-image": return response(await service.managementRemoveImage(value.id, value.imageId, value.version));
      case "category": return response(await service.managementCategory(value.input));
      case "category-select": return response(await service.managementSelectCategory(value.input));
      case "category-search": return response(await service.managementCategories(value.input));
      case "taxonomy-add": return response(await service.managementAddOption(value.input));
      case "preview": return response(await service.managementImport(value.files));
      case "import": if (typeof value.confirmation !== "string") break; return response(await service.managementImport(value.files, value.confirmation));
    }
  } catch { /* Never expose raw database, session or parser errors. */ }
  return NextResponse.json({ ok: false, error: { code: "INVALID_INPUT", message: "Yêu cầu không hợp lệ." } }, { status: 400, headers });
}
