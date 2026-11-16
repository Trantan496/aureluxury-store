# Tối ưu video Intelligence — 2026-10-22

## Phạm vi và nguồn bằng chứng

Chỉ static source inspection, metadata/container inspection bằng terminal, encode assets, lint, typecheck và build. Không browser/Test Screen/Computer Use/Playwright/screenshots/HTTP smoke/DB tests. Visual QA = **Pending Manual Review**. Chưa đo dropped frames, GPU decode, network waterfall hoặc hiệu năng thiết bị thật; không khẳng định đây là toàn bộ nguyên nhân giật trên mọi máy.

Video duy nhất trong source: `public/videos/aurel-intelligence.mp4`, trước đây được tham chiếu trực tiếp từ `src/components/home/intelligence-showcase.tsx`. Homepage `src/app/page.tsx` đặt IntelligenceShowcase đầu surface của CollectionReveal, giữa hero và collection. Đối chiếu code thực tế thay vì dựa mô tả vị trí trong tài liệu lịch sử.

## Metadata trước và sau

MB dùng hệ thập phân (1 MB = 1.000.000 bytes). Bitrate container trung bình = file bytes × 8 / thời lượng container; bitrate video = tổng kích thước samples / thời lượng track. Metadata từ FFmpeg7.1, OpenCV và đọc MP4 mvhd/mdhd/stsz/moov/mdat bằng Python. Không dùng tag `bitrate=50000000` của file gốc làm bitrate đo được.

| Asset trong public/videos | Bytes | MB | Kích thước | FPS / frames | Video / container | Codec | Bitrate video / container |
|---|---:|---:|---|---|---|---|---|
| aurel-intelligence.mp4 (gốc) | 133.706.545 | 133,706545 | 3830×2160 | 60 / 1560 | 26s / 26,007s | H.264 Main, yuv420p, bt709 | 40,979275 / 41,129402 Mbps |
| aurel-intelligence-desktop.mp4 | 10.760.162 | 10,760162 | 1920×1082 | 30 / 780 | 26s / 26s | H.264 High level4.0, yuv420p, bt709 | 3,307679 / 3,310819 Mbps |
| aurel-intelligence-mobile.mp4 | 3.358.262 | 3,358262 | 960×542 | 30 / 780 | 26s / 26s | H.264 High level3.1, yuv420p, bt709 | 1,030242 / 1,033311 Mbps |

Desktop giảm khoảng **91,952%**, mobile **97,488%** dung lượng. Track video vẫn26 giây, không đổi tốc độ phát; fps filter bỏ bớt frames từ60 xuống30 để giảm decode work, cần manual review độ chuyển động. Gốc có AAC-LC stereo44.1kHz ~150,367kbps, hai bản web không audio vì showcase luôn muted. Không cắt cảnh hoặc crop; scale giữ tỷ lệ gần nguồn với rounding kích thước chẵn cho H.264. CSS contain/khung16:9 giữ nguyên.

Poster `aurel-intelligence-poster.webp`:32.294 bytes,1280×722, trích từ nguồn tại0,5s, WebP quality85. Có kiểm tra dimensions và pixel variance bằng terminal để loại khả năng ảnh toàn đen; chưa xem/chụp hình hoặc nghiệm thu crop/màu.

MP4 gốc có moov ở offset133.671.941 sau mdat (tail metadata); desktop/mobile moov ở offset32 trước mdat, nhờ faststart. Browser cũ có thể cần thêm range request để đọc metadata file gốc; chưa đo waterfall thực tế. File gốc giữ nguyên tại đường dẫn cũ để rollback, nhưng không còn được component tham chiếu. Vì còn nằm trong public, nó vẫn chiếm dung lượng deployment nếu hosting sao chép toàn public; không tự xóa nguồn người dùng.

## Những vấn đề tìm thấy từ source

- Payload ~134MB,4K gần đầy đủ,60FPS,video bitrate~41Mbps là tài nguyên lớn cho khung desktop tối đa khoảng974CSS px (1680×58%) và mobile. Đây là bằng chứng tải tài nguyên/decode cao, không phải phép đo GPU thực tế.
- `autoPlay` + muted/loop nghĩa là preload=metadata không đảm bảo giới hạn tải khi autoplay bắt đầu; trước đây src được khai báo ngay từ SSR, dù section chưa hiện.
- Chưa có visibility/offscreen pause, reduced-motion chỉ tắt CSS reveal chứ không tắt video, không Play/Pause, không poster và không onError fallback. Audio vẫn tồn tại dù muted.
- Không tìm thấy remount do scroll: CollectionReveal dùng ref/rAF để ghi CSS variables và không set React state theo scroll; IntelligenceShowcase không có conditional/key đổi video. Reveal650ms/translate14px và các hiệu ứng khác được giữ nguyên, không quy chúng là nguyên nhân giật nếu chưa profile.

## Cách phát/tải mới

- `showcase-video.tsx` giữ một video node, không key hoặc conditional remount. Source ban đầu vắng, preload=none, poster có từ SSR/no-JS. Picture bằng Next Image unoptimized dùng cùng URL WebP với video poster, tránh hai biến thể URL ảnh.
- Observer vùng gần200px chỉ gắn src khi motion/save-data cho phép; observer viewport riêng chỉ play khi thấy ít nhất10% khung và tab không hidden. Pause khi ra viewport/tab ẩn; không clear src, gọi load(), seek về0 hoặc đổi source để pause.
- Chọn source đúng một lần khi bắt đầu tải: viewport<=767px hoặc Save-Data chọn mobile; trường hợp khác desktop. Resize/rerender không đổi source/download; muốn đánh giá lựa chọn theo viewport khác phải reload trang. Không dùng adaptive bitrate hoặc định tuyến theo user-agent server.
- Reduced motion/Save-Data không tự tải/phát video (poster vẫn có). User có thể chủ động Play; thay đổi motion preference sẽ bỏ override và đánh giá lại. User Pause được giữ khi cuộn/tab resume. Save-Data đọc ở client khi thiết lập; chưa nghe sự kiện thay đổi connection policy trong cùng session.
- Catch play() rejection, không retry loop, có nút Play để thử từ gesture. Media error ẩn video, giữ poster và aria-live status; nút disabled khi media lỗi. Không swap source hoặc tải lại tự động khi lỗi.
- Theo yêu cầu mới nhất ngày2026-10-22, đã bỏ mọi lớp che/blur/gradient góc và hiển thị nguyên chữ trong video/poster. Không khôi phục nút Play/Pause hiển thị; click khung/Enter/Space vẫn điều khiển, có accessible label/focus-visible. Không crop/zoom/re-encode, giữ video nén/lazy/visibility/reduced-motion/poster/error fallback và overlay30% toàn khung đã duyệt.
- Fallback không có IntersectionObserver dùng passive scroll/resize + rAF đo geometry, không render React mỗi scroll. Cleanup observer/listener/pending handlers; Strict Mode giữ source và không chủ động download lại. Thay route thực sự/unmount sẽ là vòng đời media mới bình thường.

## Tái tạo assets

Không thêm package vào app/package.json. FFmpeg tool cài riêng `.local/video-tools` (imageio-ffmpeg0.6.0 đóng gói FFmpeg7.1); lần đầu sandbox chặn network/executable, chạy được ngoài sandbox. Script local `.local/encode-intelligence.py --encode` dùng `-n` không ghi đè file đã tồn tại. Các lệnh cốt lõi:

```text
ffmpeg -i public/videos/aurel-intelligence.mp4 -map 0:v:0 -an -map_metadata -1 -vf "fps=30,scale=1920:-2:flags=lanczos,setsar=1" -c:v libx264 -preset slow -crf 22 -maxrate 4500k -bufsize 9000k -pix_fmt yuv420p -profile:v high -level:v 4.0 -g 60 -threads 4 -movflags +faststart public/videos/aurel-intelligence-desktop.mp4
ffmpeg -i public/videos/aurel-intelligence.mp4 -map 0:v:0 -an -map_metadata -1 -vf "fps=30,scale=960:-2:flags=lanczos,setsar=1" -c:v libx264 -preset slow -crf 24 -maxrate 1600k -bufsize 3200k -pix_fmt yuv420p -profile:v high -level:v 3.1 -g 60 -threads 4 -movflags +faststart public/videos/aurel-intelligence-mobile.mp4
ffmpeg -ss 0.5 -i public/videos/aurel-intelligence.mp4 -frames:v 1 -vf "scale=1280:-2:flags=lanczos" -c:v libwebp -quality 85 public/videos/aurel-intelligence-poster.webp
```

Evidence numeric `.local/video-metadata.json` và `.local/video-metadata-exact.json`; FFmpeg `-i` in metadata rồi exit1 vì không khai báo output, đây không phải lỗi encode. Encoding thực tế exit0. Typecheck lần đầu gặp TS narrowing `window` thành never ở nhánh thiếu IntersectionObserver; sửa feature detection thành typeof, lượt cuối typecheck đạt.

## Kiểm tra và giới hạn

`npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build` đạt. Không chạy tests/HTTP/DB/browser vì scope chỉ cho static/metadata và ba checks trên. Không thay database/migrations/sản phẩm/env/security config, dependencies, public routes hoặc homepage order. Workspace không có Git repository để báo git diff; đã đọc và sửa đúng các file liên quan.

Manual review còn lại: desktop/tablet/mobile thật; so logo/chi tiết/chuyển động30FPS với nguồn60FPS, poster tại0,5s và điểm nối loop; Safari/iOS autoplay policy; dropped frames/GPU/network throttling; resize không restart hoặc tải hai video; pause/resume khi cuộn/tab và giữ user Pause; reduced motion/Save-Data và gesture Play; lỗi404/unsupported codec/rejected autoplay; keyboard/focus/click video/corner mask, no-JS poster và không layout shift. Không tuyên bố đã nghiệm thu các tương tác này.


### Lịch sử tinh chỉnh lớp che mềm (2026-10-22, đã hủy theo yêu cầu)
Phương án này đã gỡ khỏi source; chỉ lưu lịch sử. Trước đó thay mảng đặc bằng backdrop-filter blur7px chỉ trong góc phải dưới24%×16%, gradient espresso alpha0,12→0,72→0,92. Hai CSS masks intersect làm mềm mép trái/trên; prefixed WebKit dùng source-in. Vùng phủ mở thêm2% mỗi chiều để chứa feather, không đổi khung/asset hoặc blur toàn video. Browser không hỗ trợ backdrop-filter dùng gradient đậm hơn có feather làm fallback. Không animation filter hoặc thêm will-change. Chi phí compositing vùng nhỏ vẫn cần manual check trên mobile; chưa đo FPS hoặc xác nhận chữ được che đủ ở mọi cảnh. Visual QA Pending Manual Review, không browser/screenshots.
