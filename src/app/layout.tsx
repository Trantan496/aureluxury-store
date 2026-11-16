import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { Footer } from "@/components/layout/footer";
import { ChatProvider } from "@/components/chat/chat-context";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { MotionPreferences } from "@/components/layout/motion-preferences";
import { site } from "@/config/site";
import "./globals.css";
export const metadata: Metadata = { title: { default: site.name, template: `%s | ${site.name}` }, description: site.description };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" style={{ "--font-storefront-serif": "'Times New Roman', Cambria, serif", "--font-storefront-sans": "Arial, sans-serif", "--font-demo-dialog": "Arial, sans-serif" } as React.CSSProperties}><body><MotionPreferences/><SmoothScroll/><ChatProvider><StorefrontHeader/><main id="main-content" tabIndex={-1}>{children}</main><Footer/></ChatProvider></body></html>;
}
