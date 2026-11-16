"use client";
export default function Error({ reset }: { reset: () => void }) { return <section><h2>Chưa thể tải dữ liệu</h2><p role="alert">Dữ liệu hiện tại chưa được xác nhận. Vui lòng thử tải lại.</p><button type="button" onClick={reset}>Thử lại</button></section>; }
