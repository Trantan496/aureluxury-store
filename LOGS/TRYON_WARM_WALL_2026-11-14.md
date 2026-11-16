# Try-on: nền kem, navbar Admin và tường liền mạch — 14/11/2026

- Canvas modal #F8F5F0 đúng nền PDP; frame #EEE7DC→#F3EDE4, upload và preview tile tông kem.
- Topbar dùng chính xác background của AdminHeader trong src/components/admin/products.module.css: linear-gradient(110deg,#382513,#2c1c0f 65%,#362312); chữ#F7F1E8, border#58422E. Full-bleed toàn chiều ngang, thay margin ngoài bằng padding trong.
- Model được chỉnh bằng built-in image_gen (skill imagegen) thành alpha, asset mới public/images/aurel/tryon-editorial-model-cutout.webp. File cũ public/images/aurel/tryon-editorial-model.webp vẫn giữ. Không chỉnh ảnh input khách/packshot5/result AI.
- Tường/sàn vẽ liên tục trên toàn content bằng CSS gradient, model đặt trước giữ tỷ lệ và drop-shadow, không kéo giãn nhân vật hoặc lặp ảnh. Background thích ứng khi body cuộn, mobile vẫn nền kem và ẩn model như trước.

## Image generation
Mode: built-in edit, transparent_background=true. Target/reference: public/images/aurel/tryon-editorial-model.webp (đã xem trước edit). Output gốc: C:/Users/TAN/.codex/generated_images/01a1d836-24f4-7dc1-8ca9-96a0c347f310/exec-d9cd237b-f601-4423-acc1-c0cfc5151b47.png. WebP width650/quality92 giữ alpha, 650×1950; alphaMin0/Max255 được kiểm bằng sharp.stats. Chỉ resize/export, không dùng code chỉnh thẩm mỹ ảnh.

Prompt cuối:
Edit this existing full length fashion model photograph into a clean transparent-background photographic cutout for compositing onto a continuous pale warm cream wall in a website. Preserve exactly the same adult male identity, face, black wavy hair, expression, pose, body proportions, black blazer, black T shirt, ivory wide-leg trousers, black leather clutch, hands, black loafers, garment textures and full head-to-toe framing. Remove ONLY the white studio wall, wall shadow and floor/background, making ALL background pixels genuinely transparent alpha. Keep both shoes and entire head/hair intact. No added objects, no text, no new face, no altered clothing or pose. Clean accurate alpha edges around hair, blazer, hands, clutch and shoes, no white rectangle, no white halo. Portrait 1:3 full-length subject. This cutout will be placed over a wall painted separately in CSS.

## Files
src/components/products/virtual-tryon-modal.tsx (assetURL), virtual-tryon-modal.module.css (palette/wall); tests/tryon-storefront-ui.test.tsx (assetURLassertion); assetcutout; docs/{PROJECT_CONTEXT,ARCHITECTURE,ROADMAP,DESIGN_SYSTEM,DECISIONS,SESSION_LOG}.md. Giữ thay đổi reviews/chat/nav có trước, không API/schema/data/envchange.

## Kiểm tra và phát hành
- Targeted ESLint modal/test: đạt. SSR test-name-pattern “renders the reference layout”:1/1đạt, xác nhận assetURLmới + slot5. Không chạy lại test missing4/0ảnh không đổi.
- Assetalpha/visual:1caseđạt (hasAlpha=true, alphaMin0/Max255,fullbodygiữ/đãxemảnh). npx.cmd next build --webpack đạtcompile68s/TypeScript13.3s/10staticpages; khôngtypecheckriêng/fullsuite.
- Browserlive3000:3/3đạt desktopcolors/gradient/wallwidth/model; pending→success + POSTslot5/download; mobilecream/reducedmotion/close/nooverflow. Ảnh/APIresult dùngfixture, khôngGPU/DBwrite. Tổng5caseđộc lập (1SSR+1asset+3browser).
- GuardPID36840đúngprojectnextstart3000 rồi restart hiddenrootbuildmới. .local/tryon-warm/live.log Ready; live-error.logkhônglỗi. Artifacts: .local/tryon-warm/{desktop.png,desktop-pending.png,mobile.png,results.json,computed-colors.json,asset-check.json}.
- Đã xemdesktop1672×941/mobile390×844: khôngcònmépảnhtrắng, tườngkemliềnmạchtoànchiềungang; adminnavbargradientđúng; ảnhframekem. Chưa publicdomain/screenreader/signedin/GPUthật. Ảnhinput/resultkhôngbịđổipixelnền; chỉ frame/trangtríđượcsửa.
