# Kết nối `aureluxury.store` qua Cloudflare Tunnel

Launcher [start-aureluxury.cmd](../start-aureluxury.cmd) chạy Next.js ở `127.0.0.1:3000` và một **named Cloudflare Tunnel**. Không dùng, không tạo và không thay đổi Nginx.

## Chuẩn bị một lần trong Cloudflare

1. Đăng nhập Cloudflare, chọn zone `aureluxury.store`.
2. Vào **Networks → Tunnels**, tạo một named tunnel cho máy Windows này và cài `cloudflared` theo connector token mà Cloudflare cấp.
3. Trong tunnel đó, thêm public hostname `aureluxury.store` (và `www.aureluxury.store` nếu muốn) trỏ tới service `http://127.0.0.1:3000`. Cloudflare sẽ tạo bản ghi DNS CNAME tới tunnel.
4. Bật SSL/TLS của Cloudflare. Không dùng Flexible SSL; Tunnel kết nối outbound tới Cloudflare và ứng dụng chỉ nhận loopback HTTP.
5. Nếu dùng `www`, đặt Redirect Rule từ `www.aureluxury.store` sang `https://aureluxury.store`.

Việc tạo tunnel, DNS và public hostname thay đổi hạ tầng/public routing, nên cần thao tác trong tài khoản Cloudflare của chủ dự án.

## Cấu hình máy chạy ứng dụng

1. Cài `cloudflared` và đảm bảo lệnh `cloudflared` có trên `PATH`.
2. Trong `.env` cục bộ, đổi chính xác:

   ```dotenv
   BETTER_AUTH_URL="https://aureluxury.store"
   ```

   Giữ `BETTER_AUTH_SECRET` mạnh và `DATABASE_URL` là database production riêng. Không commit `.env` hay token tunnel.
3. Trong một Command Prompt chỉ dùng để chạy site, đặt token connector:

   ```bat
   set "CLOUDFLARE_TUNNEL_TOKEN=<token-tu-Cloudflare>"
   ```

4. Nhấp đúp `start-aureluxury.cmd`. Script sẽ khởi động database helper, build Next.js, khởi động app tại `127.0.0.1:3000`, rồi chạy tunnel.

## Vận hành và giới hạn hiện tại

- Nhấn `Ctrl+C` trong cửa sổ launcher để dừng tunnel. Cửa sổ Next.js được mở riêng; đóng nó khi muốn dừng toàn bộ app.
- Trước public launch, cần cấu hình database production, secret manager, backup/PITR, mail sender và kiểm thử login/checkout bằng hostname HTTPS thật.
- Không đổi Nginx trong phạm vi này. Nếu cần reverse proxy/Nginx thay vì Tunnel, hãy xác nhận kiến trúc và máy đích trước.
