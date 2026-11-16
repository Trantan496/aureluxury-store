import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { generateGroqReply, type Retrieval, type Retriever } from "../src/features/chat/groq-bot.ts";
import { planChatRetrieval } from "../src/features/chat/retrieval-plan.ts";

dotenv.config({ path: [".env.local", ".env"], quiet: true });
const enabled = process.env.GROQ_RAG_DB_TEST === "true";
const reader = async () => (await import("../src/features/chat/chat-service.ts")).retrieveChatCatalog;
const previous = [{ senderRole: "CUSTOMER" as const, content: "Mình quan tâm áo khoác nam" }];
const noLinks = (text: string) => assert.doesNotMatch(text, /https?:\/\/|\/(?:products|cart|checkout|account|try-on)/);

test("1. Áo khoác nam: RAG khóa giới tính/danh mục, Qwen dùng kết quả thật", { skip: !enabled }, async () => {
  const retrieve = await reader();
  let context: Retrieval | undefined;
  const capture: Retriever = async (query, plan) => context = await retrieve(query, plan);
  const reply = await generateGroqReply("Mình quan tâm áo khoác nam", capture);
  assert.equal(context?.status, "success");
  assert.ok(context?.products.length);
  assert.ok(context?.products.every(product => product.categoryName === "Áo khoác" && ["men", "unisex"].includes(product.gender ?? "")));
  assert.equal(reply.suggestions?.length, context?.products.length);
  assert.doesNotMatch(reply.content, /chưa tìm thấy|tạm thời chưa kết nối/);
  noLinks(reply.content);
  assert.ok(reply.suggestions?.every(product => typeof product.stock === "number" && product.sizes?.length));
});

test("2. Trench Coat: chỉ trả trench, không gắn shirt/hoodie", { skip: !enabled }, async () => {
  const retrieve = await reader();
  const result = await retrieve("Tìm áo khoác Trench Coat");
  assert.equal(result.status, "success");assert.ok(result.products.length);
  assert.ok(result.products.every(product => /trench/i.test(product.name) && product.categoryName === "Áo khoác"));
});

test("3. Blazer black nam: khớp chính xác và stock thẻ lấy từ biến thể", { skip: !enabled }, async () => {
  const retrieve = await reader();
  const result = await retrieve("Áo blazer black nam");
  assert.equal(result.products.length, 1);
  const product = result.products[0];
  assert.match(product.name, /BLAZER BLACK/);assert.equal(product.gender, "men");
  assert.equal(product.stock, product.variants?.reduce((total, variant) => total + variant.stock, 0));
  assert.equal(product.currency, "VND");
});

test("4. Thật là? giữ sản phẩm trước nhưng không spam lại thẻ", { skip: !enabled }, async () => {
  const retrieve = await reader();
  const earlier = await retrieve("Áo blazer black nam");
  let context: Retrieval | undefined;
  const reply = await generateGroqReply("Thật là?", async (query, plan) => context = await retrieve(query, plan), [
    { senderRole: "CUSTOMER", content: "Áo blazer black nam" },
    { senderRole: "BOT", content: "Có mẫu blazer nam bạn nhé.", suggestions: earlier.products },
  ]);
  assert.deepEqual(context?.products.map(product => product.id), earlier.products.map(product => product.id));
  assert.equal(reply.suggestions?.length, 0);noLinks(reply.content);
  assert.doesNotMatch(reply.content, /tạm thời chưa kết nối/);
});

test("5. Lời chào sau câu hỏi sản phẩm: không truy xuất/không hiện thẻ", { skip: !enabled }, async () => {
  let calls = 0;
  const reply = await generateGroqReply("Xin chào bạn", async () => { calls++; throw new Error("Không được truy xuất"); }, previous);
  assert.equal(calls, 0);assert.equal(reply.suggestions?.length, 0);
  assert.doesNotMatch(reply.content, /tạm thời chưa kết nối/);noLinks(reply.content);
});

test("6. Áo khoác ZX999 không có: không lấy áo khoác bất kỳ làm kết quả", { skip: !enabled }, async () => {
  const retrieve = await reader();
  const result = await retrieve("Áo khoác ZX999 nam");
  assert.equal(result.status, "success");assert.deepEqual(result.products, []);
});

test("7. Chuyển nhu cầu sang nữ: ghi đè giới tính nam của lịch sử", { skip: !enabled }, async () => {
  const retrieve = await reader();
  const message = "Cho mình xem áo khoác nữ";
  assert.equal(planChatRetrieval(message, previous).gender, "women");
  let context: Retrieval | undefined;
  const reply = await generateGroqReply(message, async (query, plan) => context = await retrieve(query, plan), previous);
  assert.ok(context?.products.length);
  assert.ok(context?.products.every(product => product.gender === "women" || product.gender === "unisex"));
  assert.equal(reply.suggestions?.length, context?.products.length);noLinks(reply.content);
  assert.doesNotMatch(reply.content, /tạm thời chưa kết nối/);
});

test.after(async () => {
  if (enabled) { const { prisma } = await import("../src/lib/db/client.ts"); await prisma.$disconnect(); }
});
