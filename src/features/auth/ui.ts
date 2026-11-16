export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify";
export type AuthFields = { email?: string; name?: string; password?: string; confirm?: string; remember?: boolean };
type Reply = { error: { status?: number; code?: string } | null };
export type AuthUIApi = {
  signIn: { email(input: { email: string; password: string; rememberMe: boolean }): Promise<Reply> };
  signUp: { email(input: { name: string; email: string; password: string; callbackURL: string }): Promise<Reply> };
  requestPasswordReset(input: { email: string; redirectTo: string }): Promise<Reply>;
  resetPassword(input: { token: string; newPassword: string }): Promise<Reply>;
  sendVerificationEmail(input: { email: string; callbackURL: string }): Promise<Reply>;
  signOut(): Promise<Reply>;
};

export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://aurel.invalid");
    if (url.origin !== "https://aurel.invalid" || /%/.test(url.pathname) || /^\/(api|login|register|forgot-password|reset-password)(\/|$)/.test(url.pathname) || url.searchParams.has("token")) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}

export function validateAuthFields(mode: AuthMode, fields: AuthFields): string | null {
  if (mode !== "reset" && (!fields.email || fields.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))) return "Vui lòng nhập địa chỉ email hợp lệ.";
  if (mode === "register" && (!fields.name?.trim() || fields.name.trim().length > 100)) return "Vui lòng nhập họ tên từ 1 đến 100 ký tự.";
  if (["login", "register", "reset"].includes(mode) && (!fields.password || fields.password.length > 128 || (mode !== "login" && fields.password.length < 12))) return "Mật khẩu cần từ 12 đến 128 ký tự.";
  if (["register", "reset"].includes(mode) && fields.password !== fields.confirm) return "Mật khẩu xác nhận chưa khớp.";
  return null;
}

export function authErrorMessage(mode: AuthMode | "logout", error: { status?: number; code?: string }): string {
  if (["INVALID_ORIGIN", "INVALID_REDIRECT_URL", "INVALID_CALLBACK_URL"].includes(error.code ?? "")) return "Địa chỉ truy cập chưa phù hợp. Vui lòng mở lại trang đăng nhập từ địa chỉ chính thức của cửa hàng.";
  if (error.status === 429) return "Bạn đã thử quá nhiều lần. Vui lòng chờ một phút rồi thử lại.";
  if ((error.status ?? 0) >= 500 && error.status !== 503) return "Hệ thống tài khoản đang gặp sự cố. Vui lòng thử lại sau.";
  if (error.status === 503 || error.code === "EMAIL_DELIVERY_UNAVAILABLE") return "Dịch vụ hiện chưa sẵn sàng. Vui lòng thử lại sau.";
  if (mode === "login") return "Không thể đăng nhập. Hãy kiểm tra email và mật khẩu.";
  if (mode === "reset") return "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.";
  if (mode === "register") return "Chưa thể tạo tài khoản. Hãy kiểm tra thông tin hoặc thử đăng nhập nếu bạn đã đăng ký.";
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại sau.";
}

// UI orchestration only. Validation, hashing, tokens and sessions remain in Better Auth.
export async function submitAuth(mode: AuthMode, fields: AuthFields, api: AuthUIApi, origin: string, token = ""): Promise<{ ok: boolean; message: string }> {
  const validation = validateAuthFields(mode, fields);
  if (validation) return { ok: false, message: validation };
  if (mode === "reset" && !token) return { ok: false, message: authErrorMessage("reset", {}) };
  try {
    const email = fields.email?.trim() ?? "";
    const callbackURL = `${origin}/verify-email?result=processed`;
    const result = mode === "login" ? await api.signIn.email({ email, password: fields.password!, rememberMe: Boolean(fields.remember) })
      : mode === "register" ? await api.signUp.email({ name: fields.name!.trim(), email, password: fields.password!, callbackURL })
      : mode === "forgot" ? await api.requestPasswordReset({ email, redirectTo: `${origin}/reset-password` })
      : mode === "reset" ? await api.resetPassword({ token, newPassword: fields.password! })
      : await api.sendVerificationEmail({ email, callbackURL });
    if (result.error) return { ok: false, message: authErrorMessage(mode, result.error) };
    return { ok: true, message: mode === "forgot" || mode === "verify"
      ? "Yêu cầu đã được tiếp nhận. Nếu địa chỉ phù hợp, bạn sẽ nhận được email hướng dẫn. Hãy kiểm tra cả thư rác."
      : mode === "reset" ? "Mật khẩu đã được cập nhật. Các phiên đăng nhập cũ đã được thu hồi."
      : mode === "register" ? "Tài khoản đã được tạo. Bạn cần đăng nhập để tiếp tục." : "Đăng nhập thành công." };
  } catch { return { ok: false, message: "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại." }; }
}

export async function logout(api: Pick<AuthUIApi, "signOut">): Promise<{ ok: boolean; message: string }> {
  try { const result = await api.signOut(); return result.error ? { ok: false, message: authErrorMessage("logout", result.error) } : { ok: true, message: "Đã đăng xuất." }; }
  catch { return { ok: false, message: "Không thể đăng xuất. Vui lòng thử lại." }; }
}
