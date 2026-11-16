import { normalizeSearchText, tokenizeSearchQuery } from "../catalog/search-ranking.ts";
import { DEFAULT_QUICK_REPLIES, type ChatHandlingMode, type ChatProductSuggestion } from "./types.ts";

export type BotReplyResult = {
  content: string;
  suggestions?: ChatProductSuggestion[];
  quickReplies?: string[];
  nextMode?: ChatHandlingMode;
};

export type CatalogSuggestionFinder = (query: string) => Promise<ChatProductSuggestion[]>;

const HUMAN_HANDOFF_TERMS = [
  "gap nhan vien",
  "nhan vien tu van",
  "nhan vien",
  "tu van vien",
  "nguoi that",
  "chu shop",
  "ho tro truc tiep",
  "khieu nai",
  "goi lai",
  "lien he truc tiep",
  "human",
  "agent",
  "staff",
];

const SIZE_TERMS = [
  "chon size",
  "tu van size",
  "kich co",
  "size",
  "chieu cao",
  "can nang",
  "so do",
  "mac so may",
  "form rong",
  "form om",
];

const ORDER_TERMS = [
  "don hang",
  "kiem tra don",
  "theo doi don",
  "giao hang",
  "van chuyen",
  "ship",
  "bao lau nhan",
  "thanh toan",
  "payos",
  "cod",
  "chuyen khoan",
];

const RETURN_POLICY_TERMS = [
  "doi tra",
  "doi size",
  "hoan tien",
  "bao hanh",
  "chinh sach",
  "bao quan",
  "giat",
  "ui",
  "chat lieu",
  "cashmere",
];

const GREETING_TERMS = ["xin chao", "chao shop", "chao ban", "chao ad", "hello", "hi", "hey", "shop oi", "ad oi"];

const PRODUCT_HINTS = [
  "trench",
  "coat",
  "jacket",
  "bomber",
  "fleece",
  "ao khoac",
  "khoac",
  "ao len",
  "len",
  "knit",
  "sweater",
  "cardigan",
  "quan",
  "trouser",
  "pants",
  "tui",
  "tote",
  "bag",
  "khan",
  "scarf",
  "so mi",
  "shirt",
  "ao thun",
  "polo",
  "hoodie",
  "tim",
  "mua",
  "san pham",
  "mau",
  "gia",
  "aurel",
  "aur",
];

function includesAnyPhrase(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some(p => {
    if (p.length <= 3) {
      return normalized.split(" ").includes(p);
    }
    return normalized.includes(p);
  });
}

export async function generateCareBotReply(
  rawMessage: string,
  findSuggestions?: CatalogSuggestionFinder,
): Promise<BotReplyResult> {
  const norm = normalizeSearchText(rawMessage);
  const tokens = tokenizeSearchQuery(rawMessage);

  // 1. Human Staff Handoff
  if (includesAnyPhrase(norm, HUMAN_HANDOFF_TERMS)) {
    return {
      content:
        "Yêu cầu của bạn đã được chuyển tới **Chuyên viên Tư vấn AUREL**. Nhân viên của shop sẽ tiếp nhận và phản hồi trực tiếp trong khung chat này ngay khi online.\n\nBạn có thể nhắn thêm chi tiết sản phẩm, size mong muốn hoặc số điện thoại để shop hỗ trợ nhanh hơn nhé.",
      nextMode: "WAITING_STAFF",
      quickReplies: ["Tìm áo khoác Trench Coat", "Tư vấn chọn size", "Bật lại trợ lý tự động"],
    };
  }

  // 2. Size Guide
  if (includesAnyPhrase(norm, SIZE_TERMS)) {
    return {
      content:
        "Bảng quy đổi kích cỡ tham khảo chuẩn phom dáng Quiet Luxury của AUREL:\n" +
        "• **Size S**: 1m55 – 1m65 | 45 – 55 kg (vai gọn, phom tinh giản)\n" +
        "• **Size M**: 1m65 – 1m73 | 55 – 65 kg (cân đối tiêu chuẩn)\n" +
        "• **Size L**: 1m72 – 1m80 | 65 – 75 kg (thoải mái, dễ layering)\n" +
        "• **Size XL**: 1m78 – 1m86 | 75 – 85 kg (dáng rộng thanh lịch)\n\n" +
        "Nếu bạn thích mặc dáng áo khoác phủ ngoài áo len dày, hãy cân nhắc tăng 1 size hoặc cho mình biết chiều cao/cân nặng cụ thể nhé!",
      quickReplies: ["Tìm áo khoác Trench Coat", "Chính sách đổi trả", "Gặp nhân viên tư vấn"],
    };
  }

  // 3. Order Tracking & Payment
  if (includesAnyPhrase(norm, ORDER_TERMS)) {
    return {
      content:
        "Thông tin đơn hàng & giao nhận tại AUREL:\n" +
        "• **Theo dõi đơn**: Bạn có thể xem trạng thái từng đơn trực tiếp tại mục **Tài khoản → Đơn của tôi** (`/account/orders`).\n" +
        "• **Thời gian giao dự kiến**: Nội thành 1–2 ngày làm việc, toàn quốc 2–4 ngày làm việc.\n" +
        "• **Thanh toán**: Hỗ trợ COD (kiểm tra ngoại quan trước khi thanh toán) và chuyển khoản QR payOS xác nhận tức thì.\n\n" +
        "Nếu cần kiểm tra gấp một mã đơn cụ thể, hãy gửi mã đơn hoặc bấm **Gặp nhân viên tư vấn**.",
      quickReplies: ["Chính sách đổi trả", "Gặp nhân viên tư vấn", "Tìm áo khoác Trench Coat"],
    };
  }

  // 4. Return & Fabric Care Policy
  if (includesAnyPhrase(norm, RETURN_POLICY_TERMS)) {
    return {
      content:
        "Chính sách Đổi trả & Chăm sóc chất liệu AUREL:\n" +
        "• **Đổi size / sản phẩm**: Hỗ trợ đổi trong vòng **07 ngày** kể từ khi nhận hàng với sản phẩm còn nguyên tem mác, chưa qua sử dụng hay giặt ủi.\n" +
        "• **Bảo quản cao cấp**: Các thiết kế dạ len, cashmere và lụa nên được giặt khô hoặc giặt tay nước lạnh nhẹ nhàng, phơi phẳng trên mặt lưới để giữ phom dáng bền đẹp.\n\n" +
        "Bạn cần đổi đơn hàng hay tư vấn chất liệu mẫu nào không?",
      quickReplies: ["Tư vấn chọn size", "Kiểm tra đơn hàng", "Gặp nhân viên tư vấn"],
    };
  }

  // 5. Product Search using real catalog & Smart Search engine
  const isProductQuery =
    includesAnyPhrase(norm, PRODUCT_HINTS) ||
    (tokens.length > 0 && !includesAnyPhrase(norm, GREETING_TERMS));

  if (isProductQuery) {
    let suggestions: ChatProductSuggestion[] = [];
    if (findSuggestions) {
      try {
        suggestions = (await findSuggestions(rawMessage)).slice(0, 3);
      } catch {
        suggestions = [];
      }
    }

    if (suggestions.length > 0) {
      return {
        content: `Mình tìm thấy ${suggestions.length} thiết kế AUREL phù hợp với yêu cầu của bạn. Bạn có thể bấm vào từng thẻ sản phẩm bên dưới để xem chi tiết kích cỡ và màu sắc còn hàng:`,
        suggestions,
        quickReplies: ["Tư vấn chọn size", "Gặp nhân viên tư vấn"],
      };
    }

    // Greeting check before empty product fallback
    if (includesAnyPhrase(norm, GREETING_TERMS)) {
      return {
        content:
          "Xin chào bạn! Chào mừng bạn đến với không gian tư vấn AUREL.\nMình có thể hỗ trợ bạn tìm thiết kế phù hợp, tư vấn chọn size, kiểm tra đơn hàng hoặc kết nối trực tiếp với chuyên viên tư vấn của shop.",
        quickReplies: [...DEFAULT_QUICK_REPLIES],
      };
    }

    return {
      content: `Hiện mình chưa tìm thấy mẫu khớp trực tiếp trong bộ sưu tập trực tuyến cho từ khóa **"${rawMessage.trim()}"** (hoặc danh mục đang cập nhật).\n\nBạn có thể thử tìm bằng bộ lọc tại trang Sản phẩm (/products?q=${encodeURIComponent(rawMessage.trim())}) hoặc chọn **Gặp nhân viên tư vấn** để shop kiểm tra kho trực tiếp giúp bạn!`,
      quickReplies: ["Tìm áo khoác Trench Coat", "Tư vấn chọn size", "Gặp nhân viên tư vấn"],
    };
  }

  // 6. Greeting / Default Fallback
  if (includesAnyPhrase(norm, GREETING_TERMS)) {
    return {
      content:
        "Xin chào bạn! Chào mừng bạn đến với AUREL.\nBạn đang tìm kiếm mẫu trang phục nào, cần tư vấn size hay muốn kiểm tra đơn hàng? Chọn nhanh gợi ý bên dưới hoặc nhắn trực tiếp cho mình nhé!",
      quickReplies: [...DEFAULT_QUICK_REPLIES],
    };
  }

  return {
    content:
      "Cảm ơn bạn đã nhắn tin cho AUREL! Mình đã ghi nhận câu hỏi của bạn.\nNếu bạn cần tìm sản phẩm cụ thể, xem bảng size, kiểm tra đơn hàng hay trò chuyện với nhân viên tư vấn thật, hãy chọn nhanh bên dưới hoặc để lại lời nhắn nhé.",
    quickReplies: [...DEFAULT_QUICK_REPLIES],
  };
}
