# Điều tra ảnh sản phẩm AUREL — 13/11/2026

## Phạm vi và mức chắc chắn

Không sửa source/runtime, không restart/build, không đổi cache, schema, dữ liệu hay cấu hình PostgreSQL. Dùng Playwright điều khiển Chrome headless cài sẵn, viewport 1440×1000, mạng máy hiện tại, không throttle. Đo homepage production `https://aureluxury.store/`, sau đó cuộn đến collection.

Có 5 cold + 5 warm thành công. Cold = Chrome process/context mới, browser cache trống; warm = điều hướng lại trong cùng context sau cold. Không phải server/DB cold start: không xóa OS DNS cache, PostgreSQL shared buffers hoặc restart dịch vụ. Một lần thử ban đầu chờ `load` timeout 60 giây, chưa lưu trace hoàn chỉnh; script sửa thành chờ DOMContentLoaded và chạy lại cặp đầu, không loại outlier khỏi 10 mẫu thành công.

Mỗi lượt kèm probe cùng ảnh 62.850 byte qua 4 origin; tổng 40 HTTP probe, không phải 40 page navigation. Thêm 10 lần SELECT cặp quyền/binary và 10 lần gọi hàm Prisma trong tiến trình riêng để phân tích thành phần, không phải bộ test nghiệp vụ. Không chạy test suite. Mọi kết luận giới hạn ở homepage, 8 ảnh sản phẩm và môi trường đo; chưa đại diện catalog/PDP/mobile hoặc tải nhiều khách đồng thời.

## Kết quả chính

Không tái hiện được request ảnh 3,45 giây trong 10 lượt thành công. Dữ liệu hiện tại chỉ ra **thời điểm phát hiện/request ảnh trong cold page và độ trễ public network**, cộng **animation khi cuộn**, là các phần đáng kể. Chưa chứng minh PostgreSQL hoặc pool là bottleneck của request production hiện tại. `no-store` và `unoptimized` là đặc điểm kiến trúc đã xác nhận, chưa đủ để quy nguyên nhân cho chúng khi không có thử nghiệm đối chứng.

| Thành phần / nguyên nhân | Bằng chứng | Thời gian / giá trị | Ảnh hưởng trong mẫu | Hướng tiếp theo, chưa thực hiện tối ưu |
|---|---|---|---|---|
| Browser: request ảnh được bắt đầu muộn ở cold page | Resource Timing, 5 cold/5 warm | Request upload đầu: median 790ms cold (736–1086), 183ms warm (144–233) | Lớn; chênh khoảng 607ms trước khi tải bắt đầu | Điều tra phân rã tải JS, React commit/hydration, Suspense và native lazy scheduling; chưa quy toàn bộ cho hydration |
| Network/public path | Cùng ảnh 62.850 byte, 10 probe mỗi origin | 127.0.0.1:3000 median 8,42ms (5,63–12,19); localhost:3000 9,69ms (8,18–43,32); public 286,97ms (243,50–365,89) | Lớn so với local; chênh median public-local khoảng 279ms | Tách Cloudflare edge ↔ Tunnel ↔ origin; không gọi toàn bộ chênh lệch là thời gian Tunnel |
| Network trong Chrome, kết nối tái sử dụng | 80 upload resource entries trong 10 page loads | Cold median wait request→first byte 119,1ms, download 35ms, total 158,1ms; warm 121,6 / 20,55 / 143,75ms | Vừa; không phải vài giây trong mẫu | Đối chiếu mạng người dùng khi tái hiện lỗi. Node fetch probe và Chrome khác connection/client nên không trộn hai phân phối |
| Browser: fade/stagger | CSS và animation events trong trace khi cuộn | CSS 600ms + delay 0/90/180/270ms; trace ví dụ cold #2 khoảng 599–882ms từ animation start→end | Lớn với cảm giác đạt đầy đủ opacity; ảnh có thể tải xong trước khi vào viewport | A/B tại cùng thời điểm cuộn với CSS override trước khi reveal; lượt này chỉ toggle sau settle, chưa có causal A/B đầy đủ |
| Database: SELECT quyền | EXPLAIN ANALYZE + pg roundtrip, 10 cặp | Execution 0,051ms; pg roundtrip median 0,381ms (0,245–1,190) | Nhỏ trong mẫu không tải nặng | Không thêm index chỉ vì thấy seq scan; bảng nhỏ, 94 ProductImage/24 Product theo plan |
| Database: đọc binary | SELECT thật trả đủ 62.850 byte, 10 cặp | pg roundtrip median 0,605ms (0,471–1,282); EXPLAIN 0,022ms | Nhỏ trong mẫu | EXPLAIN không phản ánh đầy đủ TOAST/network serialization; dùng kết quả SELECT trả binary để đánh giá |
| Server/Prisma: public image path | Gọi chính `readPublishedImage` bằng Prisma riêng, log SQL | Đúng 2 SELECT/lần; warm tổng hàm 1,83–3,42ms; lần đầu client mới 305,67ms | Warm nhỏ; cold process có chi phí đáng kể | Lần đầu riêng bao gồm Prisma/connection/JIT, không phải SQL engine 305ms và không chứng minh production cold start |
| Server middleware/auth | Production middleware manifest rỗng; nhánh public trả về trước `imageStored` | Không có application middleware trong manifest; nhánh public không gọi resolver admin theo code | Chưa thấy auth là nguyên nhân ảnh public | Chưa có span từ request production; không gán số 0ms cho framework overhead/auth trên mọi ảnh |
| Pool | Config max5; snapshot pg_stat_activity 11 connections (10 idle, 1 active là phép đo); isolated Prisma pool waiting=0 ở cuối 10 lần | Không thấy wait/lock ở snapshot | Chưa chứng minh pool saturation | Snapshot không loại trừ burst queue. Cần acquire/release telemetry theo từng request production |
| Cache và kích thước | Header no-store, Cloudflare BYPASS, srcset rỗng cho uploads | 8 ảnh đều request lại ở warm; sample 1024×1536 hiển thị khoảng 293px rộng | Có chi phí lặp và decode thừa; chưa đo mức cải thiện nếu đổi | Chỉ cân nhắc cache/variants sau khi xác định đường critical, có cơ chế thu hồi quyền ảnh |
| CPU/RAM/disk | 8 snapshot trong khi Chrome chạy | CPU median 18,5%, max30%; RAM còn 2931–3420MB; disk queue 0–1 | Không thấy nghẽn hệ thống kéo dài trong cửa sổ đo | Snapshot 2s có thể bỏ lỡ spike; chưa đo riêng event-loop delay Node |

## Waterfall và LCP

Đơn vị ms, median; TCP+TLS bao gồm TLS nên không cộng TLS lần nữa.

| Metric | Cold (5) | Warm (5) |
|---|---:|---:|
| DNS của document | 7,6 | 0 |
| Connection TCP+TLS | 79,7 | 0 (reuse) |
| TLS riêng | 52,1 | 0 (reuse) |
| Document TTFB từ navigation start | 234,9 | 121,9 |
| Document request→first byte, gồm network+server | 134,3 | 120,2 |
| Document download | 7,6 | 7,6 |
| LCP | 844 | 208 |
| Request upload đầu | 790,4 | 183,3 |
| PaintImage record upload đầu | 911,4 | 306,7 |

LCP của tất cả 10 lượt là ảnh hero `warm_toned_cinematic_fashion_duo.png` qua Next image optimizer, **không phải ảnh sản phẩm** dưới fold. LCP không đo trực tiếp thời gian collection hiển thị.

`PaintImage` là record dựng paint, có thể xảy ra khi raster vùng gần viewport; không đồng nghĩa pixel đã hiện trên màn hình. Không báo thời điểm hiển thị hoàn toàn từng ảnh từ record này. `Decode Image` trên toàn trang cold median 6,63ms/event, max16,90ms; warm median9,07ms, max15,86ms. Đây là các slice có thể chạy song song, không cộng đơn giản, chưa nối chính xác từng decode slice với URL upload. Tổng CPU `Paint` toàn trace median16,20ms cold /14,66ms warm, không phải elapsed render delay.

| Cặp | Cold document TTFB | Cold LCP | Cold request ảnh đầu | Warm document TTFB | Warm LCP | Warm request ảnh đầu |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 234,9 | 1680 | 1085,8 | 126,7 | 224 | 183,8 |
| 2 | 237,0 | 844 | 790,4 | 121,9 | 208 | 183,3 |
| 3 | 225,2 | 808 | 735,5 | 99,7 | 168 | 144,1 |
| 4 | 276,6 | 944 | 790,4 | 140,9 | 272 | 232,7 |
| 5 | 183,5 | 832 | 774,1 | 119,2 | 196 | 173,4 |

## Request đồng thời, lazy, hydration, Suspense

- Peak image requests in flight: 7 cold /4 warm, tính mọi ảnh, không riêng uploads. Có 8 upload URLs khác nhau/lượt, mỗi URL request đúng một lần; không thấy request lặp upload do re-render trong mẫu.
- Trước cuộn, 4 upload đầu đã complete dù top khoảng 2000px, viewport cao1000px; loading=lazy. Đây là native lazy load gần viewport, không có nghĩa chỉ bắt đầu load khi xuất hiện. Sau cuộn tải thêm 4 ảnh. Không thấy tất cả 22 DOM images đều là eager.
- CollectionGrid useEffect tạo IntersectionObserver, dataset animate/visible; filter thay đổi mới tái cài observer. CollectionReveal cập nhật CSS qua RAF, không set React state mỗi scroll. Không thấy effect refetch ảnh trong hai component này.
- HTML dùng server data và client components. Home await getCatalog; App Router có loading.tsx/Suspense streaming. Trace có CLS lớn 0,294 ở 4/5 cold, 0 ở cold đầu; warm chỉ khoảng0,000059. Cold #2 ghi nhận một node có rect cũ [0,650,1440,294] biến mất, phù hợp khả năng fallback/layout replacement; chưa map node đó thành component để kết luận nguyên nhân cụ thể.
- Long task >50ms: 4/5 cold có một task khoảng55–66ms gần thời điểm request ảnh bắt đầu; warm không có. Quan hệ thời gian không chứng minh toàn bộ delay là hydration. Cần React profiling/commit markers riêng nếu muốn phân rã.
- Upload ảnh dùng Next Image unoptimized, loading lazy, fetchPriority auto, không srcset. Hero đầu có preload. Requests khác (Next prefetch) được lưu trong JSON; không thấy prefetch làm request upload trùng trong 10 lượt. Không suy ra re-render count từ số request.

## Local, production và Tunnel

- PID20876 là `next start`, lắng nghe :3000; PID41576 là `next dev`, 127.0.0.1:3005. Không restart cả hai.
- Ảnh qua public và :3000 đều200/cùng62.850 byte; :3005 trả500 cả10 probe nên loại khỏi so sánh hiệu năng ảnh thành công. Không coi 500 nhanh/chậm là số đo render ảnh hợp lệ.
- Có cloudflared đang chạy. Config yml local tìm được chỉ khai báo domain khác; chưa xác minh ingress AUREL (có thể cấu hình remote/service). Public-local chênh lệch đo được là tổng network/edge/tunnel/origin-path, chưa phân bổ riêng được Tunnel.
- Node production đã chạy trước phép đo; isolated fresh Prisma client305,67ms không giải thích trực tiếp production request1,66s trước đây.

## Phần chưa đo được chính xác

1. Chưa có span nội bộ request production để tách framework handler, pool acquire, auth, query, binary serialization và response flush. Đo local8,42ms là upper envelope request hoàn chỉnh ở local, không phải từng span. Route trả một buffer sau khi đọc đủ DB, không stream trực tiếp PostgreSQL; thời gian response headers→body end không đồng nhất thời gian server streaming CPU.
2. Chưa đo event-loop lag/GC riêng PID20876; không suy ra từ CPU toàn máy. Không bật inspector hoặc inject instrumentation vào live runtime theo ràng buộc giữ nguyên runtime.
3. Chưa có cold PostgreSQL/OS hoặc server restart experiments; không xóa shared buffers.
4. Animation override chỉ thực hiện trên browser sau khi chờ settle: computed transition chuyển0s, cùng layout/opacity1. Không phải đối chứng bật/tắt trước khi tải/reveal; không báo một số cải thiện tải giả định.
5. Chưa có browser filmstrip/Element Timing để nối chính xác ảnh tải xong→first visible pixel→opacity1. Chưa đo catalog/PDP/mobile và không tái hiện request3,45s.

Vì vậy chưa thể tuyên bố đã giải thích chính xác lần3,45s trước đây. Kết quả đủ để **không ưu tiên sửa SQL/cache vội** và thu hẹp bước kế tiếp: request discovery/hydration/Suspense + browser reveal, và phân rã public network path.

## Artifacts và lệnh đã chạy

- `.local/image-diagnostics/results/measurements.json`: waterfall CDP/Resource Timing/paint/LCP/CLS, request initiators, headers, lazy geometry, animation computed styles, direct-origin probes.
- `results/1-cold-trace.json` … `5-warm-trace.json`: 10 Chrome trace, mở được trong Chrome DevTools Performance (Load profile).
- `results/database.json`: settings, activity, plans và SELECT roundtrips; `prisma.json`: exact SQL/count/duration trong process riêng; `resources.json`: CPU/RAM/disk; `summary.json`: median/min/max.
- Công cụ chỉ ở `.local/image-diagnostics/` gồm measure.mjs, database.mjs, prisma.ts, analyze.py và Playwright dependency riêng. Không đổi package.json/package-lock gốc.
- Đã chạy `node .local/image-diagnostics/measure.mjs`, `node .local/image-diagnostics/database.mjs`, `node --conditions=react-server --import tsx .local/image-diagnostics/prisma.ts`, `python .local/image-diagnostics/analyze.py` và OS read-only snapshots. DB script lần đầu sai module path; Prisma script lần đầu sai ESM format; sửa chỉ script công cụ rồi chạy lại thành công.
- Không lint/typecheck/build/application test vì không thay app. Không thay quyết định kiến trúc.
