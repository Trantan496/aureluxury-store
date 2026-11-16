import { Suspense } from "react";
import { AuthShell } from "./auth-shell";
import { AuthForm } from "./auth-form";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";
import { createResendDelivery } from "@/features/auth/resend";
import type { AuthMode } from "@/features/auth/ui";

const copy = {
  login: ["Chào mừng trở lại.", "Đăng nhập để tiếp tục hành trình phong cách của riêng bạn."],
  register: ["Một khởi đầu riêng.", "Tạo tài khoản AUREL. Những điều tinh giản, dành cho bạn."],
  forgot: ["Bắt đầu lại, nhẹ nhàng.", "Nhập email của bạn. Nếu địa chỉ phù hợp, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu."],
  reset: ["Mật khẩu mới.", "Chọn một mật khẩu riêng, an toàn cho tài khoản AUREL của bạn."],
  verify: ["Xác minh email.", "Giữ kết nối với AUREL qua địa chỉ email thuộc về bạn."],
};
export function AuthPage({ mode }: { mode: AuthMode }) {
  if (mode === "login") return <LoginPage/>;
  if (mode === "register") return <RegisterPage/>;
  const deliveryAvailable = Boolean(createResendDelivery({ RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM }));
  return <AuthShell title={copy[mode][0]} intro={copy[mode][1]}><Suspense fallback={<p role="status">Đang tải biểu mẫu…</p>}><AuthForm mode={mode} deliveryAvailable={deliveryAvailable}/></Suspense></AuthShell>;
}
