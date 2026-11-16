"use client";
import { ActionLink } from "@/components/ui/action-link";
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="container page-section error-state"><p className="eyebrow">TẠM THỜI GIÁN ĐOẠN</p><h1>Chưa thể tải trang.</h1><p>Đã có lỗi xảy ra. Vui lòng thử lại hoặc trở về trang chủ.</p><div className="error-actions"><button className="button" onClick={reset}>Thử lại ↗</button><ActionLink href="/" secondary>Về trang chủ</ActionLink></div></div>; }
