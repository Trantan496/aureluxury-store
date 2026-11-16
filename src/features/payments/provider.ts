import "server-only";
import { PayOS } from "@payos/node";
import { paymentConfig } from "./rules";
export function payosClient() {
  // Turning off new checkout must not turn off receipts for existing links.
  const { clientId, apiKey, checksumKey } = paymentConfig(process.env, false);
  return new PayOS({ clientId, apiKey, checksumKey, baseURL: "https://api-merchant.payos.vn", timeout: 10000, maxRetries: 0, logLevel: "off", logger: null });
}
