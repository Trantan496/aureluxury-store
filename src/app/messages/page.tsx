import type { Metadata } from "next";
import { MessagesPageView } from "@/components/chat/messages-page-view";

export const metadata: Metadata = {
  title: "Nhắn tin với AUREL",
  description: "Trò chuyện trực tiếp cùng chuyên viên và trợ lý chăm sóc khách hàng AUREL.",
};

export default function MessagesPage() {
  return <MessagesPageView />;
}
