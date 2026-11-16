import Link from "next/link";
import { productServicePolicies, type ProductServicePolicies } from "@/config/product-service-policies";
import styles from "./product-detail.module.css";
const services = [{ key: "shipping", label: "Vận chuyển" }, { key: "returns", label: "Đổi trả" }, { key: "payment", label: "Thanh toán" }] as const;
function ServiceIcon({ name }: { name: typeof services[number]["key"] }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "shipping" && <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8M5 9h5M7 7v4"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>}
    {name === "returns" && <><path d="m3 6 9-4 9 4v12l-9 4-9-4ZM3 6l9 5 9-5M12 11v11M7 4l10 5v6"/><path d="m14 13 3 2 3-2"/></>}
    {name === "payment" && <><path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z"/><path d="m8 12 3 3 5-6"/></>}
  </svg>;
}
export function ProductServiceBenefits({ preview = false, policies = productServicePolicies }: { preview?: boolean; policies?: ProductServicePolicies }) {
  const visible = services.filter(({ key }) => preview || policies[key]?.text.trim());
  if (!visible.length) return null;
  return <div className={styles.serviceBenefits} aria-label={preview ? "Thông tin dịch vụ · Bản xem trước" : "Thông tin dịch vụ"}>
    {visible.map(({ key, label }) => {
      const policy = policies[key]?.text.trim() ? policies[key] : null;
      const content = <><ServiceIcon name={key}/><span>{policy ? policy.text : <>{label}<small>Chưa cấu hình · PREVIEW</small></>}</span></>;
      return policy?.href ? <Link key={key} href={policy.href} className={styles.serviceBenefit}>{content}</Link> : <div key={key} className={styles.serviceBenefit}>{content}</div>;
    })}
  </div>;
}
