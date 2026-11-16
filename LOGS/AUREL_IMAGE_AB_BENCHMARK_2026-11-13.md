# A/B tối ưu hiển thị ảnh AUREL — 13/11/2026

## Kết quả bàn giao

Chỉ giữ 3 thay đổi nhỏ đã đo:

1. Fade/translate của collection card: 600ms → 200ms.
2. Stagger mỗi card: 90ms → 40ms, tối đa 270ms → 120ms.
3. Root loading fallback: giữ chiều cao tối thiểu 100svh để footer không xuất hiện ở y=650 rồi bị đẩy khỏi viewport khi dữ liệu về.

Không giữ eager, không đổi ranh giới Suspense, không bật resize lúc request hoặc cache public. Không sửa ảnh gốc, quality, dữ liệu sản phẩm, quyền ảnh, SQL, schema/index hay dependency ứng dụng. Màu sắc, typography, layout, hover zoom và reduced motion của AUREL giữ nguyên.

File runtime: `src/components/home/collection-grid.tsx`, `src/components/home/collection.module.css`, `src/app/loading.tsx`. Ba file root khớp nội dung snapshot đã benchmark (bỏ khác biệt CRLF/LF). Không build vào `.next` live và chưa deploy/restart production.

## Phương pháp và giới hạn

- Dùng Playwright + Chrome headless cài sẵn, viewport1440×1000, DPR1, mạng không throttle. Production source snapshot riêng, Next16.4.3 webpack, PostgreSQL thật chỉ đọc; secret được truyền qua env cho process, không sao chép file env.
- Mỗi phương án đủ **5 cold + 5 warm**. Tổng7 phương án gồm baseline = **70 page navigations benchmark**. Cold là Chrome/context mới, browser cache trống; warm điều hướng lại cùng context. Server/OS/DB không được reset mỗi lượt. Có chi phí khởi tạo server ở cặp đầu của một số build, giữ nguyên outlier trong dữ liệu.
- Ngoài benchmark:2 browser acceptance (reduced motion/mobile),2 unit cases (empty/error),20 curl requests (5 cặp new/reuse cho mỗi local/public),16 phép biến đổi ảnh offline (8 ảnh ×2 kích thước). Số lượt benchmark vượt giới hạn mặc định10 vì yêu cầu cụ thể5cold+5warm cho mỗi thay đổi ở tác vụ này; không chạy full test/integration suite.
- Không chạy build và browser benchmark đồng thời. Các build/test được tách cổng/distDir; số server snapshot cư trú đã được giảm trong quá trình đo. OS file cache, server initialization và tải máy chưa hoàn toàn kiểm soát; đây không phải randomized crossover có ý nghĩa thống kê cho mọi metric. Không quy cải thiện request start/LCP cuối chỉ cho CSS.
- Visible time được sample mỗi RAF: cả4 card đầu phải có ảnh complete/naturalWidth>0, nằm trong viewport, không bị che ở điểm kiểm tra, opacity hiệu dụng qua ancestors ≥0,99. Mốc tính từ lệnh scroll tới collection sau khi trang có thời gian settle1600ms. Filmstrip CDP JPEG65/everyNthFrame3 tối đa20 frame/lượt dùng đối chiếu pixel. Đây là đo **ready-before-scroll reveal**, không phải cam kết latency từ click trang trên mọi tốc độ cuộn. RAF là proxy gần thời điểm paint, không đo photon vật lý/first-visible chính xác tới từngms.
- Ghi đồng thời DOM insertion, effect bắt đầu, Resource Timing, LCP, CLS có DOM source, HTTP request/response/chunks và query calls của pg.Client trong server snapshot. Probe SQL chỉ ghi timestamp/kind, không ghi params hoặc dữ liệu cá nhân. Query probe chỉ dùng trong process riêng, không đưa vào source ứng dụng.

## Baseline và bản giữ lại

Median5 mẫu mỗi ô; đơn vịms, trừ transfer/query/CLS. LCP ở đây là ảnh hero, không phải product cards.

| Metric | Baseline cold | Final cold | Baseline warm | Final warm |
|---|---:|---:|---:|---:|
| Request upload đầu từ navigation | 229,4 | 170,9 | 84,8 | 40,4 |
| Cả4 ảnh visible sau scroll | **825,3** | **329,3** | **818,9** | **328,6** |
| LCP hero | 372 | 236 | 112 | 56 |
| Transfer8 product images, byte | 259.510 | 259.510 | 259.510 | 259.510 |
| SQL calls toàn lượt, gồm catalog/prefetch | 77 | 77 | 77 | 77 |
| CLS median | 0,000059 | 0,000059 | 0,000059 | 0,000059 |
| Số lượt có CLS>0,1 | 0/5 | 0/5 | 2/5 | 0/5 |

Reveal giảm khoảng496ms cold và490ms warm, tương đương60%. Đối chứng chỉ animation cũng đo312,9/319,3ms so với825,3/818,9ms, nên cải thiện reveal không phụ thuộc thay đổi network/DB.

Không thấy median LCP/transfer/query regression trong final; **không tuyên bố không có tail regression**: cold LCP max final1152ms vs baseline1040ms, n=5 quá nhỏ để suy luận p95/p99. Bước nhảy footer0,294 không xuất hiện ở10 lượt final, còn layout shift nhỏ do header khoảng0,000059 vẫn tồn tại.

## Toàn bộ phương án, kể cả phương án bị loại

Mỗi dòng cold/warm là median5 mẫu; SQL77/77 ở mọi phương án. Transfer tính tổng8 ảnh, bao gồm overhead Resource Timing300byte/resource, không phải chỉ body.

| Phương án | Request start cold/warm | Visible sau scroll cold/warm | LCP cold/warm | Transfer cold/warm (byte) | Lượt CLS>0,1 /10 | Quyết định |
|---|---:|---:|---:|---:|---:|---|
| Baseline | 229,4 /84,8 | 825,3 /818,9 | 372 /112 | 259.510 /259.510 | 2 | Đối chứng |
| Chỉ animation200/40, CSS override trước scroll | 237,6 /103,1 | 312,9 /319,3 | 336 /124 | 259.510 /259.510 | 2 | Giữ animation qua source, xác minh lại ở final |
| Shell tĩnh + Suspense chỉ collection | 218,4 /62,3 | 825,0 /826,6 | 380 /80 | 259.510 /259.510 | 0 | Không giữ: discovery cold cải thiện nhỏ; CLS vẫn tái xuất trong biến thể sau |
| Shell + eager4, override animation về600/90 | 30,6 /27,4 | 819,7 /822,5 | **468 /88** | 259.510 /259.510 | 0 | Loại: request sớm nhưng cold LCP tăng |
| Shell + eager4 + source200/40 | 19,6 /20,4 | 331,5 /331,3 | **428 /68** | 259.510 /259.510 | 0 | Loại eager: cold LCP vẫn cao hơn baseline |
| Shell + responsive variants + source200/40, lazy | 223,7 /77,1 | 323,9 /331,2 | 336 /96 | **59.726 /59.726** | 1 | Chưa giữ: byte tốt nhưng chưa đạt kiểm soát tail/processing latency |
| Final: baseline architecture +200/40 +fallback100svh | 170,9 /40,4 | 329,3 /328,6 | 236 /56 | 259.510 /259.510 | 0 | Giữ đúng3file |

Không loại bỏ mẫu xấu để làm đẹp median: variants cold#3 LCP26224ms, request đầu26031ms, dù JS resources tải xong khoảng1,2s và HTML body xong1,4s. Có khoảng scheduler/JS visibility stall chưa giải thích; **không chứng minh resize gây stall**, nhưng cũng chưa đủ bằng chứng an toàn để đưa candidate này vào runtime. Một số image requests của lượt này chờfirst-byte khoảng129–156ms; chưa có server span để tách resize/pool/OS scheduling chính xác. Cần prepared/bounded variants và đối chứng crossover dưới network profile thực trước khi giữ.

## Request discovery: Suspense, mount và hydration

- Có ảnh trong DOM trước khi effect của CollectionGrid chạy. Ví dụ baseline cold#2: DOM51ms, request221ms, effect285ms. Vì thế ảnh không được tạo hoàn toàn bởi client mount, và không thể gọi toàn bộ delay là hydration.
- Native lazy scheduling phụ thuộc layout/visibility. Nội dung được stream trong boundary ẩn và sau đó reveal bởi React; DOM insertion không đồng nghĩa có layout hiển thị hoặc resource đã request.
- Eager4 kéo request xuống khoảng20–31ms, trong khi effect vẫn muộn hơn. Đây là bằng chứng loading policy có ảnh hưởng thực tế đến discovery; không phải bằng chứng eager có lợi tổng thể, vì nó cạnh tranh tài nguyên và cold LCP tăng trong hai phương án.
- Tách Suspense không tự giải quyết hết CLS/discovery. Không giữ một refactor kiến trúc chỉ vì5mẫu đầu không có shift. Final giữ server components/data/error flow hiện tại, chỉ sửa geometry fallback.
- Mức790ms cold của báo cáo public trước không thể so trực tiếp với229ms local baseline ở đây. Khác origin, bundler/build, cache/khởi tạo và thời điểm đo; không tuyên bố đã giảm790→171ms trên production public.

## CLS: xác định đúng node và sửa nhỏ nhất

PerformanceObserver ghi source node là `<footer class="editorial-footer_footer…">`, rect cũ x0/y650/w1440/h294. Root loading dùng `.page-section` min-height65vh (650px tại viewport1000), footer còn trong viewport. Khi nội dung thật thay fallback, footer bị đẩy ra ngoài và ghi CLS0,294.

Final đặt min-height100svh ngay tại root loading component. Footer ở ngoài viewport khi đang chờ, không cần đổi homepage data flow, không giấu dữ liệu hoặc dựng sản phẩm giả. Loading vẫn có role/status và nội dung giải thích; empty/error/success collection giữ nguyên. Có ảnh filmstrip xác nhận appearance thành công, unit empty/error và browser reduced-motion/mobile đạt.

## Public–local: phân rã thay vì quy cho Tunnel

Đọc `/config` từ metrics endpoint local cloudflared, chỉ lưu hostname/service đã lọc: `aureluxury.store` → `http://127.0.0.1:3000`. Xác minh được ingress runtime, khác config yml local cũ ở lượt điều tra trước.

5 cặp curl new/reuse mỗi origin, ảnh63KB, cùng URL:

| Đường đi | New connection median | Reused connection median |
|---|---:|---:|
| Local TTFB | 6,0ms | 5,3ms |
| Local total | 6,3ms | 5,5ms |
| Public TTFB | 248,1ms | 119,8ms |
| Public total | 373,7ms | 202,7ms |

Public new connection có DNS median17,9ms; TCP và TLS là những pha riêng trong `network.json`/`summary.json` (các trường curl connect/appconnect ban đầu là **mốc cộng dồn**, không cộng như duration độc lập). Tái sử dụng kết nối bỏ setup nhưng vẫn còn khoảng114ms chênh TTFB so local, cộng thời gian body transfer.

Metrics Tunnel có4 kết nối tới Singapore; snapshot sau đo QUIC smoothed RTT38–50ms, snapshot trước đó dao động cao hơn. Đây là bằng chứng độ trễ gồm client↔edge, DNS/TLS, edge↔connector và origin, không xác định duy nhất Tunnel là nguyên nhân. Không đổi Cloudflare/QUIC/Tunnel config vì chưa có per-request trace ở edge/connector để kiểm chứng lợi ích.

Trong giai đoạn sau phép đo network, cổng live3000 ngừng lắng nghe (đã kiểm tra socket/PID read-only; không xác định nguyên nhân). Không có lệnh dừng/restart live3000 trong tác vụ. Benchmark tiếp trên snapshot; vì vậy chưa có before/after public của source được chọn và chưa deploy.

## Responsive variants và chất lượng

- Prototype chỉ trong snapshot: bounded widths96/192/384/640/960/1280/1920; sharp resize không enlarge, WebPquality82; quyền publication/admin vẫn được kiểm tra trước transform, cache headers vẫn private/no-store. Không sửa schema/index hoặc dữ liệu.
- Browser chọn384px cho card rộng khoảng293px ở DPR1: tổng8 body ảnh257.110→57.326byte; Resource Timing259.510→59.726byte, giảm khoảng77%.
- Offline8 ảnh:384px so ở display293px có MAE0,95–1,32 trên thang255; PSNR tối thiểu39,42dB. Đã xem contact sheet original/variant. Thumbnail96px so ở80px: tổng9.310byte, PSNR tối thiểu35,47dB. Không dùng chỉ số này thay thế nghiệm thu chất liệu ở DPR2/zoom.
- Chưa tích hợp thumbnail vào PDP/admin: thay URL thumbnail có thể thêm request riêng cạnh ảnh chính; cần đo PDP5cold/5warm trước khi nhận thay đổi đó. Không tuyên bố đã benchmark thumbnail browser.
- Không giữ request-time resize vì chưa xác minh được tail và chi phí CPU/pool dưới tải. Hướng hợp lý tiếp theo là variants được chuẩn bị/bounded cache theo content hash, tách khỏi cache quyền, rồi A/B ở DPR1/DPR2 và public network; đây chưa phải tính năng đã triển khai.

## Cache public và revocation

Đã kiểm tra điều kiện hiện tại: route đọc lại active product + websitePermission + rightsReference trước trả binary; upload tạo UUID mới. Khi đổi ảnh, URL mới giúp cache versioning; **không giải quyết thu hồi URL cũ đã ở CDN**. Khi ẩn sản phẩm/thu quyền, origin sẽ từ chối request mới, nhưng CDN `public,max-age` có thể trả byte cũ mà không hỏi origin.

Vì không có cơ chế edge purge/tombstone được kiểm chứng cùng transaction đổi quyền, **không bật cache public và không benchmark một cấu hình có thể sai quyền chỉ để lấy số nhanh**. Final vẫn private/no-store, BYPASS,2SELECT/ảnh đã công khai. Không nói đã có invalidation/revocation cache mới.

Đánh giá hai hướng chưa triển khai: (1) private browser revalidation+ETag, chỉ304 sau khi re-authorize, có thể giảm warm bytes nhưng vẫn phải trả network RTT; (2) cache public có purge tất cả URL/width khi hide/change cùng SLA/race handling rõ ràng. Server-side cache kết quả resize chỉ được dùng **sau** kiểm tra quyền hiện tại và key theo hash bytes; không cache quyết định quyền. Các hướng này cần tác vụ benchmark riêng, không suy ra tốc độ cải thiện từ thiết kế.

## Kiểm tra thực tế và artifacts

-7×(5cold+5warm) thành công; có filmstrip/JSON cho mọi phương án.
- `npm.cmd run lint`: exit0; `npm.cmd run typecheck`: exit0.
- `node --conditions=react-server --experimental-strip-types --test --test-name-pattern="empty catalog stays empty|reader errors are never" tests/collection.test.ts`:2/2pass, không chạy4case khác của file.
- Browser acceptance: reduced motion opacity1/transition0s; mobile390×844 không overflow, card167px,2cột:2/2pass.
-5 isolated webpack builds: baseline/shell/eager/variants/final, compile/build thành công. Snapshot config bỏ validation TypeScript để giới hạn source snapshot; không gọi đó là thay thế cho root typecheck. Root typecheck chạy riêng và đạt. Không có `npm run build` ghi vào live `.next`.
- Công cụ chạy thử từng gặp lỗi Windows file URL/ESM hoặc cổnglive không còn; đã sửa **công cụ** và ghi dữ liệu đo thành công, không đổi runtime để chữa công cụ. Không xóa outlier.

Artifacts dưới `.local/image-diagnostics/ab-results/`: mỗi stage có `measurements.json` và filmstrip; `summary.json`, `network.json`, `quality/summary.json`, contact sheets, `acceptance.json`, `mobile-final.png`. `ab-queries.ndjson` là query-probe timestamps riêng; `ab.mjs`, `ab-summary.py`, `network.mjs`, `quality.mjs`, `acceptance.mjs` tái tạo được phép đo. Các source thử nghiệm bị loại chỉ còn trong build/artifacts riêng, không có trong `src/` gốc.

Chỉ giữ snapshot cuối cổng3006 cho review; đã dừng các server thử3007/3008, baseline3006 cũ và variants3009 sau đo bằng PID/command/port đã xác minh. Không dừng dev3005 hoặc service khác. Bản source cần một lần deployment được kiểm soát và public verification riêng; không coi kết quả local là cam kết public p95.
