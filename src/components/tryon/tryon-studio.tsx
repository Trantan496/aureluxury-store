"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { inferTryOnClothType } from "@/features/tryon/cloth-type";
import styles from "./tryon-studio.module.css";

type Stage = "idle" | "preparing" | "generating" | "completed" | "error";

export interface TryOnGarmentOption {
  id: string;
  name: string;
  imageUrl: string;
  slug?: string;
  categoryLabel?: string;
  isDemo?: boolean;
}

interface HealthState {
  status: string;
  model?: string;
  device?: string;
  acceleration?: string;
  error?: string | null;
}

interface TryOnResult {
  imageBase64: string;
  mimeType: string;
  model?: string;
  device: string;
  garmentCacheHit: boolean;
  timingsMs: {
    preprocessMs: number;
    inferenceMs: number;
    postprocessMs: number;
    totalMs: number;
  };
}

export const DEMO_TRYON_GARMENTS: readonly TryOnGarmentOption[] = [
  {
    id: "demo-knit",
    name: "AUREL Cashmere Knit (Mẫu thử)",
    imageUrl: "/images/aurel/collection-demo/knit.png",
    categoryLabel: "Mẫu thử nhanh",
    isDemo: true,
  },
  {
    id: "demo-coat",
    name: "AUREL Tailored Coat (Mẫu thử)",
    imageUrl: "/images/aurel/collection-demo/coat.png",
    categoryLabel: "Mẫu thử nhanh",
    isDemo: true,
  },
];

function isSafeLocalGarmentUrl(value?: string): value is string {
  if (!value) return false;
  return value.startsWith("/images/") && !value.includes("..") && !value.includes("\\");
}

export function TryOnStudio({
  catalogGarments,
  catalogStatus,
  initialGarmentUrl,
  initialGarmentName,
  eyebrow = "AUREL / PHÒNG THỬ ĐỒ AI",
  heading = "Phòng thử đồ của bạn.",
  subtitle = "Tải lên ảnh toàn thân và chọn trang phục từ cửa hàng hoặc từ máy của bạn để tạo ảnh mặc thử bằng AI.",
}: {
  catalogGarments: readonly TryOnGarmentOption[];
  catalogStatus: "success" | "empty" | "error";
  initialGarmentUrl?: string;
  initialGarmentName?: string;
  eyebrow?: string;
  heading?: string;
  subtitle?: string;
}) {
  const personInputId = useId();
  const garmentInputId = useId();

  const garmentOptions = useMemo(() => {
    const merged: TryOnGarmentOption[] = [...catalogGarments];
    const existingUrls = new Set(merged.map((item) => item.imageUrl));

    if (isSafeLocalGarmentUrl(initialGarmentUrl) && !existingUrls.has(initialGarmentUrl)) {
      merged.unshift({
        id: "selected-pdp",
        name: initialGarmentName?.trim() || "Sản phẩm đã chọn",
        imageUrl: initialGarmentUrl,
        categoryLabel: "Từ trang sản phẩm",
      });
      existingUrls.add(initialGarmentUrl);
    }

    for (const demo of DEMO_TRYON_GARMENTS) {
      if (!existingUrls.has(demo.imageUrl)) {
        merged.push(demo);
      }
    }
    return merged;
  }, [catalogGarments, initialGarmentName, initialGarmentUrl]);

  const defaultSelected = useMemo(() => {
    if (isSafeLocalGarmentUrl(initialGarmentUrl)) {
      const matched = garmentOptions.find((item) => item.imageUrl === initialGarmentUrl);
      if (matched) return matched;
    }
    return garmentOptions[0] ?? DEMO_TRYON_GARMENTS[0];
  }, [garmentOptions, initialGarmentUrl]);

  const [health, setHealth] = useState<HealthState | null>(null);
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [selectedGarment, setSelectedGarment] = useState<TryOnGarmentOption>(defaultSelected);

  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);

  async function refreshHealth() {
    try {
      const res = await fetch("/api/try-on", { cache: "no-store" });
      const data = (await res.json()) as HealthState;
      setHealth(data);
    } catch {
      setHealth({ status: "offline", error: "Không thể kiểm tra /api/try-on" });
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/try-on", { cache: "no-store" })
      .then((res) => res.json() as Promise<HealthState>)
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealth({ status: "offline", error: "Không thể kiểm tra /api/try-on" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (personPreview) URL.revokeObjectURL(personPreview);
    };
  }, [personPreview]);

  useEffect(() => {
    return () => {
      if (garmentPreview) URL.revokeObjectURL(garmentPreview);
    };
  }, [garmentPreview]);

  function onPersonChange(e: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Vui lòng chọn ảnh định dạng JPG, PNG hoặc WebP.");
      setStage("error");
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setErrorMsg("Kích thước ảnh tối đa là 10 MB.");
      setStage("error");
      return;
    }
    if (personPreview) URL.revokeObjectURL(personPreview);
    setPersonFile(file);
    setPersonPreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
    setStage("idle");
  }

  function onGarmentChange(e: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Vui lòng chọn ảnh trang phục định dạng JPG, PNG hoặc WebP.");
      setStage("error");
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setErrorMsg("Kích thước ảnh trang phục tối đa là 10 MB.");
      setStage("error");
      return;
    }
    if (garmentPreview) URL.revokeObjectURL(garmentPreview);
    setStage("idle");
    setGarmentFile(file);
    setGarmentPreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  }

  function chooseOption(option: TryOnGarmentOption) {
    if (busy) return;
    setStage("idle");
    if (garmentPreview) {
      URL.revokeObjectURL(garmentPreview);
      setGarmentPreview(null);
    }
    setGarmentFile(null);
    setSelectedGarment(option);
    setResult(null);
    setErrorMsg(null);
  }

  async function runTryOn() {
    if (!personFile || busy) return;
    setErrorMsg(null);
    setResult(null);
    setStage("preparing");

    const formData = new FormData();
    formData.append("personImage", personFile);
    if (garmentFile) {
      formData.append("garmentImage", garmentFile);
      formData.append("clothType", inferTryOnClothType({ productName: garmentFile.name }));
    } else {
      if (!selectedGarment.isDemo) {
        formData.append("productId", selectedGarment.id);
        if (selectedGarment.slug) {
          formData.append("productSlug", selectedGarment.slug);
        }
      }
      formData.append("garmentImageUrl", selectedGarment.imageUrl);
      formData.append(
        "clothType",
        inferTryOnClothType({
          categoryName: selectedGarment.categoryLabel,
          productSlug: selectedGarment.slug,
          productName: selectedGarment.name,
        })
      );
    }

    const timer = window.setTimeout(() => {
      setStage((cur) => (cur === "preparing" ? "generating" : cur));
    }, 220);

    try {
      const res = await fetch("/api/try-on", { method: "POST", body: formData });
      window.clearTimeout(timer);
      const data = (await res.json()) as TryOnResult & { error?: string };
      if (!res.ok || !data.imageBase64) {
        setErrorMsg(data.error ?? "Thử đồ thất bại.");
        setStage("error");
        return;
      }
      setResult(data);
      setStage("completed");
    } catch {
      window.clearTimeout(timer);
      setErrorMsg("Không thể kết nối tới /api/try-on.");
      setStage("error");
    }
  }

  const busy = stage === "preparing" || stage === "generating";
  const activeGarmentPreview = garmentPreview ?? selectedGarment.imageUrl;
  const activeGarmentTitle = garmentFile ? garmentFile.name : selectedGarment.name;
  const stepClass = (target: "preparing" | "generating" | "completed") => {
    if (stage === "completed") return `${styles.step} ${styles.stepDone}`;
    if (stage === target) return `${styles.step} ${styles.stepActive}`;
    if (stage === "generating" && target === "preparing") return `${styles.step} ${styles.stepDone}`;
    return styles.step;
  };

  return (
    <section className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true"><span /><span /></div>
      <div className={styles.shell}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Phòng thử đồ AI</span>
        </nav>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{heading}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={styles.healthPanel}>
            <span className={styles.health} data-ready={health?.status === "ready"} role="status">
              <i aria-hidden="true" />{!health ? "Đang kiểm tra dịch vụ AI…" : health.status === "ready" ? "AI sẵn sàng thử đồ" : "AI hiện chưa sẵn sàng"}
            </span>
            <button type="button" className={styles.textButton} onClick={() => void refreshHealth()}>Kiểm tra kết nối ↻</button>
          </div>
        </header>

        {catalogStatus !== "success" && <div className={styles.notice} role="status">
          {catalogStatus === "empty"
            ? "Cửa hàng chưa có sản phẩm kích hoạt — bạn có thể thử mẫu AUREL hoặc tải ảnh trang phục của mình."
            : "Không thể tải danh mục sản phẩm từ cơ sở dữ liệu lúc này — bạn vẫn có thể dùng mẫu AUREL hoặc tải ảnh trang phục."}
        </div>}

        <div className={styles.steps} aria-label="Tiến trình thử đồ" role="status">
          <div className={stepClass("preparing")}><b>01</b><span>Chuẩn bị ảnh</span></div>
          <div className={stepClass("generating")}><b>02</b><span>AI phối trang phục</span></div>
          <div className={stepClass("completed")}><b>03</b><span>Nhận ảnh thử đồ</span></div>
        </div>
        {errorMsg && <div role="alert" className={styles.errorBanner}>{errorMsg}</div>}

        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby={`${personInputId}-title`}>
            <div className={styles.panelHeading}><div><p className={styles.eyebrow}>BƯỚC 01 / CÁ NHÂN HÓA</p><h2 id={`${personInputId}-title`}>Chuẩn bị diện mạo</h2></div><span className={styles.headingIcon} aria-hidden="true">↗</span></div>
            <label htmlFor={personInputId} className={styles.uploadBox} data-disabled={busy}>
              <input id={personInputId} type="file" accept="image/jpeg,image/png,image/webp" className={styles.hiddenFile} onChange={onPersonChange} disabled={busy} />
              <span className={styles.uploadIcon} aria-hidden="true">↑</span>
              <strong>{personFile ? personFile.name : "Tải ảnh của bạn lên"}</strong>
              <span>Chọn ảnh chính diện, rõ toàn thân và đủ ánh sáng.</span>
              <small>JPG, PNG, WebP · Tối đa 10 MB</small>
            </label>
            <div className={styles.sectionLabel}><h3>Chọn trang phục</h3><Link href="/products">Bộ sưu tập ↗</Link></div>
            <div className={styles.garmentOptions} role="group" aria-label="Trang phục có thể thử" data-lenis-prevent>
              {garmentOptions.map((item) => (
                <button key={item.id} type="button" className={styles.garmentOption}
                  aria-pressed={!garmentFile && selectedGarment.imageUrl === item.imageUrl}
                  disabled={busy} onClick={() => chooseOption(item)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt="" loading="lazy" />
                  <span>{item.name}</span><small>{item.isDemo ? "Mẫu trải nghiệm" : item.categoryLabel ?? "Bộ sưu tập AUREL"}</small>
                </button>
              ))}
            </div>
            <div className={styles.garmentRow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeGarmentPreview} alt={activeGarmentTitle} className={styles.garmentThumb} />
              <div className={styles.garmentMeta}><small>TRANG PHỤC ĐANG CHỌN</small><p>{activeGarmentTitle}</p>
                {!garmentFile && selectedGarment.slug && <Link href={`/products/${selectedGarment.slug}`}>Xem chi tiết sản phẩm →</Link>}
              </div>
            </div>
            <label className={styles.uploadLink} data-disabled={busy} htmlFor={garmentInputId}>
              <input id={garmentInputId} type="file" accept="image/jpeg,image/png,image/webp" className={styles.hiddenFile} onChange={onGarmentChange} disabled={busy} />
              ＋ Tải ảnh trang phục khác
            </label>
            <button type="button" className={styles.primaryBtn} disabled={!personFile || busy} onClick={() => void runTryOn()}>
              {busy && <span className={styles.spinner} aria-hidden="true" />}
              {stage === "preparing" ? "Đang chuẩn bị ảnh…" : stage === "generating" ? "AI đang phối trang phục…" : "Bắt đầu thử đồ"}<span aria-hidden="true">↗</span>
            </button>
            <p className={styles.hint}>{personFile ? "Kết quả AI mang tính tham khảo về diện mạo, không xác nhận kích cỡ vừa vặn." : "Tải ảnh của bạn để bắt đầu. Mẫu trải nghiệm không phải hàng đang bán."}</p>
          </section>

          <section className={`${styles.panel} ${styles.resultPanel}`} aria-labelledby={`${personInputId}-result`} aria-busy={busy}>
            <div className={styles.panelHeading}><div><p className={styles.eyebrow}>BƯỚC 02 / KHÁM PHÁ PHONG CÁCH</p><h2 id={`${personInputId}-result`}>Diện mạo mới, vẫn là bạn.</h2></div><span className={styles.resultBadge}>{result ? "Đã hoàn tất" : busy ? "Đang xử lý" : "Trước / Sau"}</span></div>
            <div className={styles.compareGrid}>
              <div className={styles.frameCard}>
                <span className={styles.frameLabel}><b>01</b> Ảnh của bạn</span>
                <div className={styles.frameViewport}>
                  {personPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={personPreview} alt="Ảnh gốc" className={styles.frameImg} />
                  ) : <div className={styles.emptyFrame}><PersonOutline /><strong>Bắt đầu từ bạn</strong><p>Ảnh toàn thân của bạn<br />sẽ xuất hiện tại đây.</p></div>}
                </div>
              </div>
              <div className={styles.frameCard}>
                <span className={styles.frameLabel}><b>02</b> Sau khi thử đồ <span aria-hidden="true">✧</span></span>
                <div className={styles.frameViewport} data-processing={busy}>
                  {result ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={result.imageBase64} src={`data:${result.mimeType};base64,${result.imageBase64}`} alt="Kết quả thử đồ" className={`${styles.frameImg} ${styles.resultImage}`} />
                  ) : busy ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={personPreview!} alt="Ảnh đang được AI xử lý" className={`${styles.frameImg} ${styles.processingImage}`} />
                    <div className={styles.scanOverlay} aria-hidden="true"><span className={styles.scanCorners} /><span className={styles.scanLine} /></div>
                    <div className={styles.processingCaption}><span className={styles.spinner} aria-hidden="true" />Đang tạo ảnh thử đồ…</div>
                  </> : <div className={styles.emptyFrame}><span className={styles.sparkle} aria-hidden="true">✧</span><strong>Một phong cách mới</strong><p>Chọn trang phục yêu thích.<br />Để AI giúp bạn hình dung.</p></div>}
                </div>
              </div>
            </div>
            <div className={styles.resultFooter} role="status" aria-live="polite">
              <span className={styles.statusDot} data-busy={busy} aria-hidden="true" />
              <p>{result ? "Ảnh thử đồ đã sẵn sàng. Bạn có thể tải xuống hoặc chọn một trang phục khác." : busy ? "AI đang xử lý ảnh của bạn. Vui lòng giữ trang này mở; thời gian chờ tùy tải hệ thống." : "Không gian dành riêng cho phong cách của bạn. Chọn ảnh và trang phục để khám phá."}</p>
            </div>
            {result && <div className={styles.metrics}>
              <span>Thời gian xử lý: {(result.timingsMs.totalMs / 1000).toFixed(1)} giây</span>
              <a href={`data:${result.mimeType};base64,${result.imageBase64}`} download="aurel-tryon-result.png" className={styles.secondaryBtn}>Tải ảnh kết quả ↓</a>
            </div>}
          </section>
        </div>
      </div>
    </section>
  );
}

function PersonOutline() {
  return <svg className={styles.personOutline} viewBox="0 0 120 180" fill="none" aria-hidden="true"><circle cx="60" cy="27" r="18" /><path d="M37 55Q60 47 83 55L99 110Q101 119 94 120Q87 122 84 113L77 87L80 167Q80 175 72 175Q65 175 65 167L60 120L55 167Q55 175 48 175Q40 175 40 167L43 87L36 113Q33 122 26 120Q19 119 21 110Z" /></svg>;
}
