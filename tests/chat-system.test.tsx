import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const imageModule = new URL("../node_modules/next/image.js", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/image") {
      return { url: `${imageModule}?node-interop`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith("?node-interop")) {
      return {
        format: "module",
        source: `import image from ${JSON.stringify(imageModule)}; export default image.default ?? image;`,
        shortCircuit: true,
      };
    }
    if (url.endsWith(".module.css")) {
      return {
        format: "module",
        source: "export default new Proxy({}, { get: (_, key) => String(key) });",
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});

const { createChatStore } = await import("../src/features/chat/chat-store.ts");
const { generateCareBotReply } = await import("../src/features/chat/care-bot.ts");
const { StorefrontHeader } = await import("../src/components/layout/storefront-header.tsx");
const { Footer } = await import("../src/components/layout/footer.tsx");
const { MessagesPageView } = await import("../src/components/chat/messages-page-view.tsx");
const { ChatPanel } = await import("../src/components/chat/chat-panel.tsx");
const { default: MessagesConnectingPage } = await import("../src/app/messages/connecting/page.tsx");
const { SellerPortalNav } = await import("../src/components/admin/seller-portal-nav.tsx");
const { PathnameContext } = await import(
  "next/dist/shared/lib/hooks-client-context.shared-runtime.js"
);
const { AppRouterContext } = await import(
  "next/dist/shared/lib/app-router-context.shared-runtime.js"
);

const noopRouter = {
  bfcacheId: "test",
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
};

test("Case 1: startConversation starts Bot greeting, first customer message gets 1 Bot reply then hands off to Staff", async () => {
  const tempFile = path.join(os.tmpdir(), `aurel-chat-test-${Date.now()}-${Math.random()}.json`);
  const store = createChatStore(tempFile);
  try {
    const conv = await store.getOrCreateByParticipant({
      participantKey: "guest:test-1",
      userId: null,
      customerName: "Nguyễn Minh",
      customerEmail: null,
    });
    assert.equal(conv.hasStarted, false);
    assert.equal(conv.botReplyCount, 0);
    assert.equal(conv.messages.length, 0);

    // User clicks "Bắt đầu cuộc hội thoại" -> Bot sends opening greeting
    const started = await store.startConversation(conv.id);
    assert.equal(started.hasStarted, true);
    assert.equal(started.mode, "BOT");
    assert.equal(started.messages.length, 1);
    assert.equal(started.messages[0].senderRole, "BOT");

    // First message from customer -> Bot replies once & sets mode to WAITING_STAFF
    const msg1 = await store.appendMessage({
      conversationId: conv.id,
      senderRole: "CUSTOMER",
      senderName: "Nguyễn Minh",
      content: "Cho mình hỏi áo khoác nâu còn size M không?",
    });
    assert.equal(msg1.conversation.botReplyCount, 0);

    const botReply = await store.appendMessage({
      conversationId: conv.id,
      senderRole: "BOT",
      senderName: "AUREL Concierge Bot",
      content: "Mình đã ghi nhận câu hỏi đầu tiên và chuyển cho Chuyên viên AUREL.",
      nextMode: "WAITING_STAFF",
      incrementBotReplyCount: true,
    });
    assert.equal(botReply.conversation.mode, "WAITING_STAFF");
    assert.equal(botReply.conversation.botReplyCount, 1);

    // Second customer message goes to Staff without Bot interference; Staff replies directly
    const msg2 = await store.appendMessage({
      conversationId: conv.id,
      senderRole: "CUSTOMER",
      senderName: "Nguyễn Minh",
      content: "Mình cao 1m75 nặng 68kg mặc vừa không?",
    });
    assert.equal(msg2.conversation.mode, "WAITING_STAFF");
    assert.equal(msg2.conversation.unreadByStaff, 1);

    const staffReply = await store.appendMessage({
      conversationId: conv.id,
      senderRole: "STAFF",
      senderName: "Chuyên viên AUREL",
      content: "Chào anh Minh, 1m75 68kg mặc size L sẽ rất vừa vặn ạ.",
      nextMode: "STAFF",
    });
    assert.equal(staffReply.conversation.mode, "STAFF");
    assert.equal(staffReply.conversation.unreadByStaff, 0);
    assert.equal(staffReply.conversation.unreadByCustomer, 1);
  } finally {
    await rm(tempFile, { force: true });
  }
});

test("Case 2: createChatStore rejects empty or oversized messages and strips control chars", async () => {
  const tempFile = path.join(os.tmpdir(), `aurel-chat-test-val-${Date.now()}.json`);
  const store = createChatStore(tempFile);
  try {
    const conv = await store.getOrCreateByParticipant({
      participantKey: "guest:val-1",
      userId: null,
      customerName: "Khách",
      customerEmail: null,
    });

    await assert.rejects(() =>
      store.appendMessage({
        conversationId: conv.id,
        senderRole: "CUSTOMER",
        senderName: "Khách",
        content: "   ",
      }),
    );

    await assert.rejects(() =>
      store.appendMessage({
        conversationId: conv.id,
        senderRole: "CUSTOMER",
        senderName: "Khách",
        content: "a".repeat(1501),
      }),
    );

    const { message } = await store.appendMessage({
      conversationId: conv.id,
      senderRole: "CUSTOMER",
      senderName: "Khách",
      content: "Xin\x00 chào\x07 shop",
    });
    assert.equal(message.content, "Xin chào shop");
  } finally {
    await rm(tempFile, { force: true });
  }
});

test("Case 3: generateCareBotReply handles Size Guide, Order Tracking, Return Policy and Human Handoff", async () => {
  const sizeReply = await generateCareBotReply("Tư vấn chọn size giúp mình");
  assert.match(sizeReply.content, /Size S|Size M|Size L/);

  const orderReply = await generateCareBotReply("Kiểm tra đơn hàng payOS");
  assert.match(orderReply.content, /\/account\/orders/);

  const returnReply = await generateCareBotReply("Chính sách đổi trả thế nào?");
  assert.match(returnReply.content, /07 ngày/);

  const handoffReply = await generateCareBotReply("Cho mình gặp nhân viên tư vấn");
  assert.equal(handoffReply.nextMode, "WAITING_STAFF");
  assert.match(handoffReply.content, /Chuyên viên Tư vấn AUREL/);
});

test("Case 4: generateCareBotReply returns real suggestions when found and avoids fake products on DB error", async () => {
  const found = await generateCareBotReply("trench coat nâu", async () => [
    {
      id: "12",
      slug: "brown-trench-coat",
      name: "AUREL Brown Trench Coat (Nam)",
      price: "1950000.00",
      currency: "VND",
      imageUrl: "/images/aurel/collection-demo/coat.png",
      categoryName: "Áo khoác",
    },
  ]);
  assert.equal(found.suggestions?.length, 1);
  assert.equal(found.suggestions?.[0].name, "AUREL Brown Trench Coat (Nam)");

  const fallback = await generateCareBotReply("trench coat", async () => {
    throw new Error("DB offline");
  });
  assert.equal(fallback.suggestions, undefined);
  assert.match(fallback.content, /\/products\?q=/);
});

test("Case 5: StorefrontHeader renders message icon button and mobile /messages link", () => {
  const html = renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: noopRouter as never },
      createElement(PathnameContext.Provider, { value: "/" }, createElement(StorefrontHeader)),
    ),
  );
  assert.match(html, /aria-label="Nhắn tin với shop"/);
  assert.match(html, /href="\/messages"/);
});

test("Case 6: MessagesPageView renders 3-column AUREL Concierge UI and SellerPortalNav links /admin/messages", () => {
  const pageHtml = renderToStaticMarkup(createElement(MessagesPageView));
  assert.match(pageHtml, /FASHION CONCIERGE/);
  assert.match(pageHtml, /Đoạn chat/);
  assert.match(pageHtml, /Nhân viên AUREL/);
  assert.match(pageHtml, /AUREL Concierge Bot/);
  assert.match(pageHtml, /Ghim/);
  assert.match(pageHtml, /Tìm kiếm hội thoại hoặc chủ đề/);
  assert.match(pageHtml, /Nhắn nhanh khi lướt web/);
  assert.doesNotMatch(pageHtml, /aria-label="Sản phẩm đã lưu"/);
  assert.match(pageHtml, /aria-label="Mở menu thao tác"/);
  assert.match(pageHtml, /placeholder="Nhắn với AUREL Concierge\.\.\."/);
  assert.match(pageHtml, /\/images\/aurel\/aurel-logo\.webp/);

  const drawerHtml = renderToStaticMarkup(createElement(ChatPanel, { variant: "drawer" }));
  assert.match(drawerHtml, /aurel Official/);
  assert.match(drawerHtml, /Đang hoạt động/);
  assert.doesNotMatch(drawerHtml, /roleBadgeBot/);

  const navHtml = renderToStaticMarkup(createElement(SellerPortalNav, { active: "messages" }));
  assert.match(navHtml, /href="\/admin\/messages"/);
  assert.match(navHtml, /aria-current="page"[^>]*href="\/admin\/messages"/);
});

test("Case 7: MessagesConnectingPage renders bespoke AUREL SVG illustration, title, back button, and progress bar", () => {
  const html = renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: noopRouter as never },
      createElement(MessagesConnectingPage),
    ),
  );
  assert.match(html, /A U R E L/);
  assert.match(html, /Bạn đợi một chút nhé/);
  assert.match(html, /Quay lại/);
  assert.match(html, /connectingProgressBar/);
});

test("Case 8: Default 2 threads pin Staff on top, sort Bot threads newest-first, and support creating new chats", async () => {
  const tempFile = path.join(os.tmpdir(), `aurel-chat-threads-${Date.now()}-${Math.random()}.json`);
  const store = createChatStore(tempFile);
  const participant = {
    participantKey: "guest:threads-1",
    userId: null,
    customerName: "Lan Anh",
    customerEmail: null,
  };

  try {
    const initial = await store.listParticipantConversations(participant);
    assert.equal(initial.length, 2);
    assert.equal(initial[0].channel, "STAFF");
    assert.equal(initial[0].pinned, true);
    assert.equal(initial[0].title, "Nhân viên AUREL");
    assert.equal(initial[1].channel, "BOT");
    assert.equal(initial[1].title, "AUREL Concierge Bot");

    await new Promise(resolve => setTimeout(resolve, 15));
    const newBot = await store.createParticipantConversation({
      ...participant,
      channel: "BOT",
    });

    const afterNewBot = await store.listParticipantConversations(participant);
    assert.equal(afterNewBot.length, 3);
    assert.equal(afterNewBot[0].channel, "STAFF");
    assert.equal(afterNewBot[1].id, newBot.id);
    assert.equal(afterNewBot[2].id, initial[1].id);

    // Replying to the older Bot thread moves it ahead of the other Bot thread, still below pinned Staff
    await new Promise(resolve => setTimeout(resolve, 15));
    await store.appendMessage({
      conversationId: initial[1].id,
      senderRole: "CUSTOMER",
      senderName: "Lan Anh",
      content: "Tìm áo khoác Trench Coat",
    });

    const afterOlderBotActivity = await store.listParticipantConversations(participant);
    assert.equal(afterOlderBotActivity[0].channel, "STAFF");
    assert.equal(afterOlderBotActivity[1].id, initial[1].id);
    assert.equal(afterOlderBotActivity[2].id, newBot.id);

    // Creating a new Staff thread keeps it in the pinned Staff group on top
    await new Promise(resolve => setTimeout(resolve, 15));
    const newStaff = await store.createParticipantConversation({
      ...participant,
      channel: "STAFF",
    });
    const afterNewStaff = await store.listParticipantConversations(participant);
    assert.equal(afterNewStaff.length, 4);
    assert.equal(afterNewStaff[0].id, newStaff.id);
    assert.equal(afterNewStaff[1].id, initial[0].id);
    assert.equal(afterNewStaff[2].channel, "BOT");
  } finally {
    await rm(tempFile, { force: true });
  }
});

test("Case 9: Footer is hidden on /messages and /messages/connecting but rendered on storefront pages", () => {
  const renderFooterAt = (pathname: string) =>
    renderToStaticMarkup(
      createElement(
        PathnameContext.Provider,
        { value: pathname },
        createElement(Footer),
      ),
    );

  assert.equal(renderFooterAt("/messages"), "");
  assert.equal(renderFooterAt("/messages/connecting"), "");
  assert.match(renderFooterAt("/"), /AUREL/);
});
