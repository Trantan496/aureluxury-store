# Modal thử đồ theo ảnh tham chiếu — 14/11/2026

Thiết kế native dialog trên PDP theo ảnh chủ dự án: nền trắng, topbar thương hiệu nhỏ, hero sans-serif, người mẫu editorial bên trái, product packshot số5 + upload + CTAđen, hai frame nền xám. Không đổi storefront/PDP canvas kem, route studio, inference/API/commerce.

## Files và asset
- src/components/products/virtual-tryon-modal.tsx
- src/components/products/virtual-tryon-modal.module.css
- tests/tryon-storefront-ui.test.tsx
- public/images/aurel/tryon-editorial-model.webp (asset dự án mới)
- Docs: PROJECT_CONTEXT, ARCHITECTURE, ROADMAP, DESIGN_SYSTEM, DECISIONS, SESSION_LOG.

Ảnh được tạo bằng built-in image_gen theo skill C:/Users/TAN/.codex/skills/.system/imagegen/SKILL.md. Nguồn PNG được giữ tại C:/Users/TAN/.codex/generated_images/01a1d836-24f4-7dc1-8ca9-96a0c347f310/exec-cea6b59b-a34c-484a-a7f3-6459269402c0.png. Resize/export WebP width650/quality90 bằng sharp, không sửa thẩm mỹ ảnh bằng code. Model là ảnh minh họa trang trí, không phải ảnh sản phẩm/kết quả thử đồ. Asset WebP tồn tại trong public, không tham chiếu đường dẫn generated_images runtime.

## Prompt cuối (built-in mode)
Create a single photorealistic luxury fashion editorial photograph for a web virtual fitting room decorative sidebar. Portrait aspect ratio 1:3. Full length head to toe young adult East Asian male fashion model with natural wavy black hair, handsome neutral expression. Standing relaxed, black tailored blazer over black T shirt, high waist wide leg ivory cream trousers, polished black loafers. Left hand holds a small plain black leather clutch by his thigh, right hand in pocket. Slight relaxed lean, legs naturally crossed. Entire body and shoes fully visible, slim elegant proportions. Seamless pure white studio wall and near white floor, soft realistic shadow cast behind to left, bright diffuse studio lighting. Frame model centered in narrow portrait composition, no objects except bag, no text, no logos, no UI, no watermark. This is illustrative fashion imagery, not an actual try-on result. Save output into project C:/Users/TAN/Downloads/E-commerce website/public/images/aurel/tryon-editorial-model.png if file saving is supported.

## Kiểm tra
- Targeted ESLint TSX/test đạt.
- 3 SSR case: reference layout/slot5;4ảnhdisabled;0ảnhdisabled. Case reference lần đầu fail do regex cũ cấm cả aria-label mới “Chuẩn bị ảnh thử đồ”, không phải UI lỗi. Sửa assertion và chỉ retry case reference đạt;2case khác không chạy lại.
- next build --webpack compile43s/TypeScript6.1s/10staticpages đạt; không typecheck riêng.
- 5 browser case live3000: desktop reference/slot5/asset/empty/Escape; pending→success/download+POSTslot5;servererror/retry;invalidformat/noPOST;mobilereducedmotion/scroll/close. Tất cả đạt, POST fixture không GPU/DBwrite. AssetvisualQA1caseđạt. Tổng9 tình huống độc lập (3SSR+5browser+1assetvisual), khôngfullsuite.
- Screenshots/results: .local/tryon-reference/{desktop-initial.png,desktop-pending.png,desktop-result.png,mobile-initial.png,mobile-frames.png,results.json}. Desktop1672×941 và mobile390×844 đã xem trực quan. /products/noire-executive-clutch-2026-nam-gen-y.

## Runtime và giới hạn
Root productionbuild mới phục vụ localhost3000. Guard restartPID5272 phát hiện process đã kết thúc nên không stop PID khác. Inventory node trống; start hidden serve.mjs3000, browser kiểm đúng build mới đạt. Các thay đổi navigation/chat có trước được giữ. Không thay backend/CatVTON hoặc cấu hình môi trường.
Chưa kiểm publicdomain, signedin/screenreader và GPUthật với ảnh người. Ảnh model minh họa không khớp tuyệt đối nhân vật trong ảnh mẫu; bố cục và phong cách theo mẫu, không tuyên bố pixel-perfect.
