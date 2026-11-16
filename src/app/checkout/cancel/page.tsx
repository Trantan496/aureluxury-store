import { PaymentReturn } from "@/components/shop/payment-return";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tiếp tục thanh toán | AUREL", robots: { index: false, follow: false } };
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <PaymentReturn searchParams={searchParams} mode="cancel"/>; }
