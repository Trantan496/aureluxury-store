# Sửa vị trí cuộn khi mở sản phẩm — 14/11/2026

## Thay đổi
- File runtime duy nhất: src/components/layout/smooth-scroll.tsx. Đọc docs hiện hành, source và hướng dẫn Link/use-client của Next16.4 trước sửa. Workspace không có repository Git nên không có gitdiff.
- Theo dõi pathname trong shared SmoothScroll. Khi chuyển sang /products/[slug] qua điều hướng mới, useLayoutEffect đặt Lenis.scrollTo(0,{immediate:true,force:true}) để reset cả vị trí lẫn đích animation. Khi reduced-motion tắt Lenis, dùng native window.scrollTo với behavior instant.
- Không reset khi pathname không đổi (variant/currency/query), khi có hash hoặc Back/Forward (popstate). Không đặt history.scrollRestoration=manual. Listener và scroller được cleanup; không thêm dependency. Không thay database/ảnh/giá/tồn kho/quyền.

## Kiểm tra
- Hai tình huống thăm dò trên runtime cũ: catalog→PDP và PDP→related đều y0 trong phiên Chrome mới; chưa tái hiện được tình trạng luôn-cuộn-xuống trong screenshot của phiên người dùng. Bản sửa bảo đảm chính sách về đầu rõ ràng, không phụ thuộc heuristic giữ cuộn của Next hoặc đích animation Lenis còn lại.
- Preview production tại3026:7 tình huống độc lập đạt (harness có6 dòng vì một dòng thực hiện Back và Forward, được tính là2case):1catalogdesktop;2relatedPDPđangcuộn;3wheelanimationđangchạy;4mobile390x844;5reducedmotion;6Backphụchồicatalog;7ForwardphụchồiPDP. Tổng10 tìnhhuống:2 thăm dò trước sửa +7 nghiệm thu preview +1 nghiệm thu live. Không chạy thêm case.
- Đã xem screenshot desktop1440x1000 và mobile390x844; trang mở từ đầu. Artifacts:LOGS/pdp-scroll-2026-11-14/.
- npx.cmd eslint src/components/layout/smooth-scroll.tsx:đạt; npm.cmd run typecheck:đạt.
- Hai snapshot production build --webpack có đầy đủ TypeScript/2workers đều exit0: .local/pdp-scroll/release và final-release. Lần2 giữ thêm thay đổi chat xuất hiện trong lúc build đầu. Không fullnpmtest/integration suite.
- So sánh source sau build2 phát hiện agent khác tiếp tục sửa chat.module.css và footer.tsx; không ghi đè các file đó. Không tuyên bố snapshot khớp toàn bộ source hiện tại.

## Vận hành và giới hạn
- Preview3026 chạy snapshot release; .data junction về root, envroot, không sửa root.next.
- Khi định chuyển live, guard phát hiện PID2248 đã bị phiên khác dừng; không stop process lạ, không khởi động đè. Phiên khác build tạiroot sau khi mã SmoothScroll đã có. Build đã hoàn tất (root .next/BUILD_ID lúc10:34:54); kiểm tra chunk26ufilixhmka7.js có scrollTo immediate/force. Sau khi xác nhận3000 trống và không còn processbuild, khởi động rootbuild mới qua hidden .local/pdp-scroll/serve-root.mjs, envroot vàbind0.0.0.0 như tiến trình trước. Không deploy snapshot cũ lên trên thay đổi chat/footer. Ready216ms.
- Chưa kiểm publicdomain, signed-in session có sẵn trong screenshot, deep-linkhash hoặc thay đổi variant/currency; các nhánh này được giữ bằng guard nhưng không tuyên bố đã test.
- Không sửa giao diện sản phẩm hoặc dữ liệu. Live smoke2535x1348 đạt:catalog scrollY2164→clickPDP→scrollY0 ổn định sau1600ms. Kết quả và screenshot:LOGS/pdp-scroll-2026-11-14/{live-result.json,live.png}. Exact next action:người dùng Ctrl+F5 để tải JS mới, mở sản phẩm; nếu phiên đã đăng nhập còn lỗi, kiểm lại đúng phiên đó trong lượt mới.
