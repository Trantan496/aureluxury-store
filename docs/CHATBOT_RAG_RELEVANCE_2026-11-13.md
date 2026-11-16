# Sửa độ phù hợp RAG và UX chat — 13/11/2026

## Nguyên nhân đã xác minh

PostgreSQL có áo khoác nam: NAVY BOMBER JACKET, BROWN TRENCH COAT, BLAZER BLACK và các mẫu khác. Bản trước có retrieval + generation nhưng retrieval chưa đủ chính xác: ghép hai câu chat vào smart search rộng, không truyền điều kiện danh mục/giới tính và lấy ba kết quả đầu. Các kết quả đều thành thẻ, kể cả câu chào hoặc câu hỏi tiếp nối. Context không chứa gender nên model còn đoán sai giới tính. Vì vậy chỉ việc gọi model thành công không chứng minh truy xuất phù hợp.

## Luồng đã sửa

- `features/chat/retrieval-plan.ts` nhận câu hiện tại/lịch sử, tách ý định, danh mục, giới tính, tên nhóm sản phẩm và từ khóa cụ thể. Câu chào/chính sách không tự tìm hàng. Câu tiếp nối dùng sản phẩm của lượt trước và ngữ cảnh có liên quan; không ghép hai câu thành query. Khi đổi nhu cầu sang nữ, bỏ giới tính nam cũ.
- `lib/db/queries/chat-products.ts` đọc PostgreSQL bằng SQL tham số hóa, khóa active + category + gender trước, AND từ khóa cụ thể (trench/blazer/black...), tối đa ba sản phẩm. Một transaction RepeatableRead đọc ID và projection giá/ảnh có quyền/biến thể/profile. Không dùng OR tag rộng của search storefront để mở rộng tập kết quả. Không sửa thuật toán tìm kiếm toàn website.
- `chat-service.ts` ánh xạ từ dữ liệu thật: gender, chất liệu, phom, giá VND, size/màu và tổng tồn biến thể active. Nếu focus ID từ lịch sử cũ không còn phù hợp, thử lại cùng bộ lọc category/gender, không lấy quần hoặc giới tính khác thay thế.
- `groq-bot.ts` đưa context đã lọc vào Qwen; chỉ gắn thẻ khi đang tìm/chọn/xem sản phẩm. Câu làm rõ/size/chào không lặp thẻ. Prompt ưu tiên dữ liệu mới hơn lời bot cũ, không suy đoán giới tính, tối đa 2–3 câu ngắn, không lặp bảng tồn/giá/size/màu đã có trong thẻ, không gửi đường dẫn. Server bỏ URL và cú pháp link khỏi câu trả lời; link điều hướng nằm ở thẻ sản phẩm.
- Đây là RAG truy xuất SQL theo metadata, không phải vector RAG. Chưa thêm embedding/vector database vì lỗi hiện tại là lọc sai/không phân biệt ý định. Parser hữu hạn các nhóm trang phục phổ biến và một số từ khóa/màu; không hứa hiểu mọi tên riêng, mọi bộ lọc/ngân sách hoặc ngôn ngữ. Cần mở rộng theo truy vấn thất bại có bằng chứng, hỏi lại khi mơ hồ.

## UX

- Dùng ba chấm nhấp nhô thay chữ đang soạn, có accessible label; reduced motion hiện chấm tĩnh.
- ReplyText dùng state cục bộ, không sửa textContent ngoài React; polling không làm replay khi ID/text giữ nguyên.
- Thẻ mới chỉ render khi callback báo text hoàn tất. Không hiện ảnh áo demo trang trí trong tin bot. Thẻ có giá, size/màu và tồn từ server; dữ liệu cũ thiếu stock không được tự bù.
- Không ép xuống đáy khi người dùng đang đọc phía trên. Vùng chat có data-lenis-prevent để wheel/touch xử lý native, tránh root smooth-scroll can thiệp. Kiểm tra cuộn trong case9 dùng vị trí scroll và sự ổn định khi text/thẻ cập nhật; chưa nghiệm thu phần cứng trackpad/wheel thực tế trên mọi thiết bị.
- Server vẫn trả JSON sau khi nhận đủ câu, sau đó UI hiện dần; chưa stream token qua mạng. Tồn kho là snapshot tại lượt truy xuất, checkout vẫn xác minh lại.

## Đúng 10 tình huống của tác vụ này

| # | Tình huống | Kiểm tra/kết quả |
|---|---|---|
| 1 | Mình quan tâm áo khoác nam | PostgreSQL + Qwen thật; chỉ outerwear men/unisex, có stock/size, không phủ nhận kết quả có thật, không link — đạt |
| 2 | Tìm áo khoác Trench Coat | PostgreSQL thật, chỉ trench, không shirt/hoodie — đạt |
| 3 | Áo blazer black nam | Đúng mẫu blazer nam; stock bằng tổng biến thể, VND — đạt |
| 4 | Thật là? sau blazer | PostgreSQL + Qwen thật, giữ focus, không lặp thẻ — đạt |
| 5 | Xin chào sau câu hỏi hàng | Qwen thật, không gọi retriever/không thẻ — đạt |
| 6 | Áo khoác ZX999 nam | PostgreSQL thật, không lấy áo bất kỳ thay mẫu không có — đạt |
| 7 | Cho xem áo khoác nữ sau nhu cầu nam | PostgreSQL + Qwen thật, đổi đúng gender — đạt |
| 8 | Chờ → hiện dần text → hiện thẻ | Chrome fixture có nhãn TEST UI; 3 chấm wave, không chữ đang soạn, thẻ chỉ sau text, có stock — đạt |
| 9 | Đọc lịch sử khi reply đang hiện | Chrome fixture dài; không kéo lại đáy trong/sau reveal và thẻ xuất hiện — đạt |
| 10 | Mobile390px + reduced motion | Chrome fixture, chấm không animation, text/thẻ hoàn tất, stock đúng fixture, không overflow trang — đạt |

Tổng 10/10 (7 Node/DB/provider + 3 browser); 4 lượt Qwen thật. Không thêm test case, không chạy fullsuite hoặc chạy lại bộ10case lượt trước. Case8 attempt1 lỗi harness vì CSS Modules đổi tên keyframe; sửa assertion regex, attempt2 đạt; case9/10 chỉ chạy một lần. Fixture UI chỉ intercept request trong browser; không tạo inventory/giá/đơn hoặc hội thoại thật. Ảnh fixture ghi rõ TEST UI.

Lệnh Node: `$env:GROQ_RAG_DB_TEST='true'; node --conditions=react-server --import tsx --test tests/chat-rag-retrieval.test.ts`.

Lệnh UI: `node .local/chat-rag-v2/ui-check.mjs`, retry chỉ case8 lỗi và case9/10 chưa chạy. Artifacts `.local/chat-rag-v2/{ui-results.json,case-8.png,case-9.png,case-10.png}`.

## Checks, đóng gói và giới hạn

- `npm.cmd run lint`: đạt trên source tại lượt đầu. ESLint các file đổi, gồm hai test files: đạt sau sửa cuối. `npm.cmd run typecheck`: đạt; chạy lại khi workspace có thay đổi reviews mới, vẫn đạt.
- Build snapshot app đầu đạt và đã dùng kiểm tra UI; đồng bộ source mới cho release vì phần reviews/PDP được chỉnh song song. Các lần build giữa bị chặn do dấu ngoặc CSS lỗi trong product-detail.module.css; chỉ sửa block media bị đóng sớm/trùng selector để bảo toàn nội dung và build lại. Không thêm kiểm thử nghiệp vụ ngoài10case.
- Đã chỉnh các assertion trong `tests/groq-chat.test.ts` theo hợp đồng mới (không URL, không thẻ lặp khi hỏi size, fallback ngắn); không chạy lại suite lịch sử trong ngân sách tác vụ này.
- Runtime mới dùng snapshot release dưới `.local/chat-rag-v2/`, env đọc từ root, bind127.0.0.1. `.data` junction về root, không xóa/ghi đè lịch sử. Build cũ giữ rollback; dev3005/preview3010 không đổi. Các nguồn ngoài chat tiếp tục được giữ theo workspace mới nhất.
- Tin nhắn cũ/bảng size cũ sai giữ nguyên lịch sử; không được coi là chính sách đã xác minh. Chưa bổ sung bảng size thật hoặc chính sách đổi trả chưa được chủ shop xác nhận. Chưa kiểm tra gửi tin trực tiếp domain public trong tác vụ này; dùng server local và test cục bộ, không nới CSRF.
