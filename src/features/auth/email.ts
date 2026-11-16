import "server-only";

export type AuthEmail = { to: string; subject: string; text: string; html: string };
// Server-side provider port. Resolve only after the provider accepts delivery;
// never log message bodies or URLs. Resend is wired through server composition.
export type AuthEmailDelivery = { send(message: AuthEmail): Promise<void> };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function authEmail(kind: "verification" | "reset", to: string, url: string): AuthEmail {
  const subject = kind === "verification" ? "AUREL AI — Xác minh email" : "AUREL AI — Đặt lại mật khẩu";
  const action = kind === "verification" ? "Xác minh email" : "Đặt lại mật khẩu";
  const duration = kind === "verification" ? "60 phút" : "30 phút";
  const text = `${action} qua liên kết sau (có hiệu lực ${duration}):\n${url}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;
  return { to, subject, text, html: `<p>${action} (có hiệu lực ${duration}):</p><p><a href="${escapeHtml(url)}">${action}</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>` };
}
