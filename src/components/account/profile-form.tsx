"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import {
  CalendarIcon,
  CameraIcon,
  ChevronDownIcon,
  HouseIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "./account-icons";
import styles from "./profile.module.css";

export type ProfileData = {
  fullName: string | null;
  email: string;
  city: string | null;
  birthYear: number | null;
  phone: string | null;
  address: string | null;
};

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1920 + 1 }, (_, i) => currentYear - i);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const birthYear = formData.get("birthYear") ? Number(formData.get("birthYear")) : "";
    const city = String(formData.get("city") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();

    startTransition(async () => {
      try {
        const payload: Record<string, unknown> = {
          action: "profile",
          name,
          city,
          birthYear: birthYear || null,
        };

        if (address || phone) {
          payload.address = address;
          payload.phone = phone;
        }

        const response = await fetch("/api/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          data?: { saved?: boolean };
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Không thể lưu thông tin.");
        }

        setData({
          ...data,
          fullName: name,
          city: city || null,
          birthYear: birthYear ? Number(birthYear) : null,
          phone: phone || null,
          address: address || null,
        });
        setStatus({ ok: true, message: "Thông tin cá nhân đã được lưu thành công." });
      } catch (error) {
        setStatus({ ok: false, message: (error as Error).message });
      }
    });
  }

  return (
    <div className={styles.container}>
      {status && (
        <div
          role={status.ok ? "status" : "alert"}
          className={status.ok ? styles.statusOk : styles.statusError}
        >
          {status.message}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar} aria-hidden="true">
              <UserIcon className={styles.avatarIcon} />
            </div>
            <button
              type="button"
              className={styles.cameraBadge}
              aria-label="Cập nhật ảnh đại diện (tính năng đang phát triển)"
              title="Cập nhật ảnh đại diện"
            >
              <CameraIcon />
            </button>
          </div>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Cập nhật thông tin cá nhân</h2>
            <p className={styles.subtitle}>
              Quản lý thông tin tài khoản để có trải nghiệm mua sắm tốt hơn.
            </p>
          </div>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          {/* Email */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-email" className={styles.label}>
              Email
            </label>
            <div className={styles.inputWrapper}>
              <div className={`${styles.control} ${styles.disabled}`}>
                <MailIcon className={styles.leadingIcon} />
                <input
                  id="profile-email"
                  type="email"
                  value={data.email}
                  disabled
                  readOnly
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Họ tên */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-name" className={styles.label}>
              Họ tên
            </label>
            <div className={styles.inputWrapper}>
              <div className={styles.control}>
                <UserIcon className={styles.leadingIcon} />
                <input
                  id="profile-name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={data.fullName ?? ""}
                  placeholder="Nhập họ và tên"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Năm sinh */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-birthYear" className={styles.label}>
              Năm sinh
            </label>
            <div className={styles.inputWrapper}>
              <div className={styles.control}>
                <CalendarIcon className={styles.leadingIcon} />
                <select
                  id="profile-birthYear"
                  name="birthYear"
                  defaultValue={data.birthYear ?? ""}
                  className={`${styles.input} ${styles.select}`}
                >
                  <option value="">Chọn năm sinh</option>
                  {years.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className={styles.trailingIcon} />
              </div>
            </div>
          </div>

          {/* Thành phố */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-city" className={styles.label}>
              Thành phố
            </label>
            <div className={styles.inputWrapper}>
              <div className={styles.control}>
                <MapPinIcon className={styles.leadingIcon} />
                <input
                  id="profile-city"
                  name="city"
                  type="text"
                  maxLength={100}
                  defaultValue={data.city ?? ""}
                  placeholder="Nhập thành phố"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Điện thoại nhận hàng */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-phone" className={styles.label}>
              Điện thoại nhận hàng
            </label>
            <div className={styles.inputWrapper}>
              <div className={styles.control}>
                <PhoneIcon className={styles.leadingIcon} />
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  defaultValue={data.phone ?? ""}
                  placeholder="Nhập số điện thoại"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Địa chỉ mặc định */}
          <div className={styles.fieldRow}>
            <label htmlFor="profile-address" className={styles.label}>
              Địa chỉ mặc định
            </label>
            <div className={styles.inputWrapper}>
              <div className={`${styles.control} ${styles.textareaControl}`}>
                <HouseIcon className={`${styles.leadingIcon} ${styles.textareaIcon}`} />
                <textarea
                  id="profile-address"
                  name="address"
                  maxLength={500}
                  defaultValue={data.address ?? ""}
                  placeholder="Nhập địa chỉ nhận hàng"
                  className={`${styles.input} ${styles.textarea}`}
                />
              </div>
            </div>
          </div>

          {/* Submit button row */}
          <div className={styles.buttonRow}>
            <div className={styles.labelSpacer} aria-hidden="true" />
            <div className={styles.inputWrapper}>
              <button
                type="submit"
                disabled={isPending}
                className={styles.submitButton}
              >
                {isPending ? "Đang lưu…" : "Lưu thông tin"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Password reset link */}
      <div className={styles.footerLink}>
        <Link href="/forgot-password" className={styles.pwdLink}>
          <LockIcon className={styles.lockIcon} />
          <span>Đổi mật khẩu qua email</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

