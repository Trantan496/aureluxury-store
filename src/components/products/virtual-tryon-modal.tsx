"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { inferTryOnClothType, type TryOnClothType } from "@/features/tryon/cloth-type";
import styles from "./virtual-tryon-modal.module.css";

type Stage = "idle" | "preparing" | "generating" | "completed" | "error";

interface TryOnTimings {
  preprocessMs: number;
  inferenceMs: number;
  postprocessMs: number;
  totalMs: number;
}

interface TryOnResponse {
  imageBase64: string;
  mimeType: string;
  model: string;
  device: string;
  garmentCacheHit: boolean;
  timingsMs: TryOnTimings;
}

export function VirtualTryOnTrigger({
  productName,
  productImages,
  categorySlug,
  categoryName,
  clothType,
}: {
  productName: string;
  productImages: readonly { url: string }[];
  categorySlug?: string | null;
  categoryName?: string | null;
  clothType?: TryOnClothType;
}) {
  const garmentImageUrl = productImages[4]?.url || undefined;
  const resolvedClothType = clothType ?? inferTryOnClothType({ categorySlug, categoryName, productName });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const [personFile, setPersonFile] = useState<File | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ device: string; totalMs: number; inferenceMs: number } | null>(null);

  useEffect(() => {
    return () => {
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    };
  }, [beforeUrl]);

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (busy) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Vui lòng chọn ảnh định dạng JPG, PNG hoặc WebP.");
      setStage("error");
      return;
    }
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setErrorMessage("Kích thước ảnh tối đa là 10 MB.");
      setStage("error");
      return;
    }

    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    setPersonFile(file);
    setBeforeUrl(URL.createObjectURL(file));
    setAfterUrl(null);
    setMeta(null);
    setErrorMessage(null);
    setStage("idle");
  }

  async function runTryOn() {
    if (!personFile || !garmentImageUrl || busy) return;
    setErrorMessage(null);
    setAfterUrl(null);
    setMeta(null);
    setStage("preparing");

    const formData = new FormData();
    formData.append("personImage", personFile);
    formData.append("garmentImageUrl", garmentImageUrl);
    formData.append("clothType", resolvedClothType);

    let generatingTimer: number | undefined;
    try {
      // Transition cleanly from Preparing (client/upload prep) to Generating (GPU inference).
      generatingTimer = window.setTimeout(() => {
        setStage((current) => (current === "preparing" ? "generating" : current));
      }, 220);

      const response = await fetch("/api/try-on", {
        method: "POST",
        body: formData,
      });

      window.clearTimeout(generatingTimer);
      const data = (await response.json()) as TryOnResponse & { error?: string };

      if (!response.ok || !data.imageBase64) {
        setErrorMessage(data.error ?? "Không thể tạo ảnh thử đồ. Vui lòng thử lại.");
        setStage("error");
        return;
      }

      setAfterUrl(`data:${data.mimeType || "image/png"};base64,${data.imageBase64}`);
      setMeta({
        device: data.device,
        totalMs: data.timingsMs?.totalMs ?? 0,
        inferenceMs: data.timingsMs?.inferenceMs ?? 0,
      });
      setStage("completed");
    } catch {
      setErrorMessage("Không thể kết nối tới máy chủ thử đồ AI. Vui lòng kiểm tra dịch vụ cục bộ.");
      setStage("error");
    } finally {
      window.clearTimeout(generatingTimer);
    }
  }

  function resetSelection() {
    if (beforeUrl) URL.revokeObjectURL(beforeUrl);
    setPersonFile(null);
    setBeforeUrl(null);
    setAfterUrl(null);
    setMeta(null);
    setErrorMessage(null);
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = stage === "preparing" || stage === "generating";
  return (
    <>
      <div className={styles.tryOnActionRow}>
        <button
          type="button"
          className={styles.tryOnPillBtn}
          disabled={!garmentImageUrl}
          onClick={openModal}
          aria-label={`Thử đồ ảo với ${productName}`}
        >
          <svg className={styles.tryOnPillIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="6.2" r="2.6" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M4.5 16.2c.4-3.1 2.6-4.7 5.5-4.7s5.1 1.6 5.5 4.7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <path d="M7.6 12.1c.7.6 1.5.9 2.4.9s1.7-.3 2.4-.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span>VIRTUAL TRY-ON</span>
          <span className={styles.tryOnPillArrow} aria-hidden="true">↗</span>
        </button>
        {!garmentImageUrl && <p className={styles.unavailableNotice}>Chưa có ảnh nền trắng số 5 để thử đồ.</p>}
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label="AUREL Virtual Try-On"
        data-lenis-prevent
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
      >
        <div className={styles.shell}>
          <header className={styles.topbar}>
            <span className={styles.wordmark}>AUREL</span>
            <span className={styles.topbarTitle}>THỬ ĐỒ AI</span>
            <button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="Đóng cửa sổ thử đồ">×</button>
          </header>
          <div className={styles.body}>
            <div className={styles.content}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.editorialModel} src="/images/aurel/tryon-editorial-model-cutout.webp" alt="" aria-hidden="true" />
              <div className={styles.hero}>
                <h2>Thử phong cách mới</h2>
                <p>Tải ảnh toàn thân và khám phá diện mạo mới cùng AUREL.</p>
              </div>
              <div className={styles.workspace}>
                <section className={styles.controls} aria-label="Chuẩn bị ảnh thử đồ">
                  {garmentImageUrl && <a className={styles.garmentRow} href={garmentImageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Xem ảnh nền trắng số 5 của ${productName}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={garmentImageUrl} alt={productName} className={styles.garmentThumb} />
                    <strong>{productName}</strong><span className={styles.chevron} aria-hidden="true">›</span>
                  </a>}
                  <label htmlFor={inputId} className={styles.uploadBox} data-disabled={busy}>
                    <input id={inputId} ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className={styles.hiddenFile} onChange={handleFileChange} disabled={busy} />
                    <UploadIcon />
                    <strong>{personFile ? personFile.name : "Tải ảnh toàn thân"}</strong>
                    <span>JPG, PNG, WebP · Tối đa 10 MB</span>
                  </label>
                  {errorMessage && <div role="alert" className={styles.errorBanner}>{errorMessage}</div>}
                  <div className={styles.actions}>
                    <button type="button" className={styles.primaryBtn} disabled={!personFile || !garmentImageUrl || busy} onClick={() => void runTryOn()}>
                      {busy && <span className={styles.spinner} aria-hidden="true" />}
                      {stage === "preparing" ? "Đang chuẩn bị ảnh…" : stage === "generating" ? "AI đang phối trang phục…" : "Bắt đầu thử đồ"}
                    </button>
                    {personFile && !busy && <button type="button" className={styles.changeBtn} onClick={resetSelection}>Đổi ảnh</button>}
                  </div>
                </section>
                <section className={styles.results} aria-label="So sánh ảnh thử đồ" aria-busy={busy}>
                  <div className={styles.compareGrid}>
                    <div className={styles.frameCard}>
                      <h3>Ảnh của bạn</h3>
                      <div className={styles.frameViewport}>
                        {beforeUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={beforeUrl} alt="Ảnh gốc của bạn" className={styles.frameImg} />
                        ) : <div className={styles.emptyFrame}><PersonIcon /><span className={styles.visuallyHidden}>Ảnh toàn thân của bạn sẽ xuất hiện tại đây.</span></div>}
                      </div>
                    </div>
                    <div className={styles.frameCard}>
                      <h3>Kết quả thử đồ</h3>
                      <div className={styles.frameViewport}>
                        {afterUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={afterUrl} alt={`Kết quả thử ${productName}`} className={`${styles.frameImg} ${styles.resultImage}`} />
                        ) : busy ? <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={beforeUrl!} alt="Ảnh đang được AI xử lý" className={`${styles.frameImg} ${styles.processingImage}`} />
                          <div className={styles.scanOverlay} aria-hidden="true"><span className={styles.scanLine} /></div>
                          <div className={styles.processingCaption}><span className={styles.spinner} aria-hidden="true" />Đang tạo ảnh thử đồ…</div>
                        </> : <div className={styles.emptyFrame}><ResultIcon /><span className={styles.visuallyHidden}>Kết quả AI sẽ xuất hiện tại đây.</span></div>}
                      </div>
                    </div>
                  </div>
                  <p className={styles.resultStatus} role="status" aria-live="polite">{afterUrl ? "Ảnh thử đồ đã sẵn sàng." : busy ? "AI đang xử lý ảnh của bạn. Vui lòng chờ…" : "Kết quả AI mang tính tham khảo về diện mạo."}</p>
                  {afterUrl && <div className={styles.resultActions}>
                    <span>{meta ? `Hoàn tất trong ${(meta.totalMs / 1000).toFixed(1)} giây` : "Đã hoàn tất"}</span>
                    <a href={afterUrl} download={`aurel-tryon-${productName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`}>Tải ảnh kết quả ↓</a>
                  </div>}
                </section>
              </div>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

function UploadIcon() {
  return <svg className={styles.uploadIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 32V6m0 0L13 17M24 6l11 11M8 31v9a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function PersonIcon() {
  return <svg viewBox="0 0 80 90" fill="none" aria-hidden="true"><circle cx="40" cy="23" r="14" /><path d="M9 80v-5a31 31 0 0 1 62 0v5" /></svg>;
}
function ResultIcon() {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><rect x="9" y="13" width="62" height="54" rx="8" /><circle cx="52" cy="29" r="5" /><path d="m12 53 16-15 17 17m-7-7 9-8 22 20" /></svg>;
}
