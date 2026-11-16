import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/**": [
      "./backend/**/*",
      "./LOGS/**/*",
      "./.data/**/*",
    ],
    "/*": [
      "./backend/**/*",
      "./LOGS/**/*",
      "./.data/**/*",
    ],
  },
  async redirects() {
    const origin = process.env.BETTER_AUTH_URL;
    if (!origin) return [];
    const canonical = new URL(origin);
    if (canonical.hostname !== "localhost") return [];
    return ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/admin/:path*", "/account/:path*", "/cart", "/checkout", "/favorites", "/products/:path*"].map(source => ({
      source,
      has: [{ type: "host" as const, value: "127\\.0\\.0\\.1" }],
      destination: `${canonical.origin}${source}`,
      permanent: false,
    }));
  },
  poweredByHeader: false, images: { qualities: [75, 90], localPatterns: [{ pathname: "/images/*" }, { pathname: "/images/!(uploads)/**" }, { pathname: "/videos/**" }] },
  logging: { incomingRequests: { ignore: [/\/reset-password/, /\/api\/auth\/verify-email/, /[?&]token=/] } },
  async headers() { return [
    { source: "/admin/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    { source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
    { source: "/api/auth/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    { source: "/checkout/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
  ]; },
};
export default nextConfig;
