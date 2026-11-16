import "dotenv/config";
import { PayOS } from "@payos/node";
import { paymentConfig } from "../src/features/payments/rules.ts";

// Manual operation only. Never called by startup, deployment or automated tests.
if (!process.argv.includes("--replace-production-webhook")) throw new Error("Xem đăng ký hiện tại trong payOS Dashboard trước. Chỉ chạy với --replace-production-webhook khi muốn thay URL webhook.");
const { clientId, apiKey, checksumKey, origin } = paymentConfig(process.env);
const webhookUrl = `${origin}/api/payos/webhook`;
const probe = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(10000) });
const response: { error?: string } = await probe.json();
if (probe.status !== 400 || response.error !== "Chữ ký webhook không hợp lệ.") throw new Error("Route public chưa sẵn sàng hoặc chưa từ chối chữ ký thiếu. Không đăng ký webhook.");
const payos = new PayOS({ clientId, apiKey, checksumKey, baseURL: "https://api-merchant.payos.vn", logLevel: "off", logger: null, timeout: 10000, maxRetries: 0 });
await payos.webhooks.confirm(webhookUrl);
console.log("Đăng ký webhook payOS thành công. Không có thanh toán hay chuyển tiền được tạo.");
