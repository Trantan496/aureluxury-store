import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse } from "dotenv";
import pg from "pg";
import sharp from "sharp";

// Business fixtures are allowed only in the verified, isolated restore from this task.
assert.equal(process.env.RUN_DISCUSSION_DB_TESTS, "true");
const manifest = JSON.parse(readFileSync(process.env.DISCUSSION_RESTORE_MANIFEST ?? ".local/backups/aurel_ai_reviews_restore_1794584261355_cf4870.dump.verified.json", "utf8"));
assert.match(manifest.restoreName, /^aurel_ai_reviews_restore_\d+_[a-f0-9]{6}$/);
assert.equal(manifest.backupRestored, true);
const url = new URL(parse(readFileSync(".env")).DATABASE_URL); url.pathname = `/${manifest.restoreName}`;
process.env.DATABASE_URL = url.toString();
const rulesUrl = new URL("../src/features/shop/rules.ts", import.meta.url).href;
const state = globalThis as typeof globalThis & { discussionActor: { id: number; role: string } | null };
state.discussionActor = null;
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/features/shop/service") return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(`import {ShopError} from ${JSON.stringify(rulesUrl)}; export async function shopActor(){if(!globalThis.discussionActor)throw new ShopError('Đăng nhập',401);return globalThis.discussionActor;}`)}` };
  if (specifier === "@/lib/auth-session") return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent("export async function resolveProductSession(){return globalThis.discussionActor?{userId:globalThis.discussionActor.id}:null}")}` };
  return next(specifier, context);
} });
const { getDiscussion, publishDiscussion, changeDiscussion, readDiscussionImage } = await import("../src/features/reviews/discussion-service.ts");
const { discussionBody } = await import("../src/features/reviews/discussion-http.ts");
const { prisma } = await import("../src/lib/db/client.ts");
const db = new pg.Client({ connectionString: url.toString() });
const marker = `discussion-test-${Date.now()}`;
let customer: number, buyer: number, admin: number, stranger: number, productId: number, root: number, reply: number;
let attachment: string;
const feed = (extra: Record<string, string> = {}) => getDiscussion(new URLSearchParams({ productSlug: marker, ...extra }));
const actor = (id: number, role = "CUSTOMER") => { state.discussionActor = { id, role }; };
before(async () => {
  await db.connect();
  assert.equal((await db.query("SELECT current_database() AS name")).rows[0].name, manifest.restoreName);
  const ids: number[] = [];
  for (const [label, role] of [["Customer", "CUSTOMER"], ["Buyer", "CUSTOMER"], ["Shop", "ADMIN"], ["Stranger", "CUSTOMER"]]) ids.push((await db.query(`INSERT INTO "User" (email,"fullName",role,"updatedAt") VALUES ($1,$2,$3,now()) RETURNING id`, [`${marker}-${label}@example.invalid`, `TEST ${label}`, role])).rows[0].id);
  [customer, buyer, admin, stranger] = ids;
  const category = (await db.query(`INSERT INTO "Category" (name,slug) VALUES ($1,$1) RETURNING id`, [marker])).rows[0].id;
  productId = (await db.query(`INSERT INTO "Product" (name,slug,"categoryId") VALUES ($1,$1,$2) RETURNING id`, [marker, category])).rows[0].id;
  const variant = (await db.query(`INSERT INTO "ProductVariant" ("productId",sku,color,size) VALUES ($1,$2,'TEST','M') RETURNING id`, [productId, marker])).rows[0].id;
  const order = (await db.query(`INSERT INTO "Order" ("orderNumber","userId",status,"totalAmount","shippingName","shippingPhone","shippingAddress") VALUES ($1,$2,'DELIVERED',0,'TEST','0','TEST') RETURNING id`, [marker, buyer])).rows[0].id;
  await db.query(`INSERT INTO "OrderItem" ("orderId","variantId","productName",sku,color,size,quantity,"unitPrice") VALUES ($1,$2,'TEST',$3,'TEST','M',1,0)`, [order, variant, marker]);
});
after(async () => { await prisma.$disconnect(); await db.end(); });

test("3: Non-buyer account publishes a real comment with a sanitized image", async () => {
  actor(customer);
  const photo = await sharp({ create: { width: 240, height: 180, channels: 3, background: "#d8c4ae" } }).png().toBuffer();
  const form = new FormData(); form.set("productSlug", marker); form.set("comment", "TEST Chất liệu trông rất đẹp <script>alert(1)</script>"); form.append("images", new File([photo], "fabric.png", { type: "image/png" }));
  const origin = new URL(parse(readFileSync(".env")).BETTER_AUTH_URL ?? "https://aureluxury.store").origin;
  process.env.BETTER_AUTH_URL = origin;
  const prepared = await discussionBody(new Request(`${origin}/api/product-discussion`, { method: "POST", headers: { Origin: origin }, body: form }));
  const result = await publishDiscussion(prepared.input, prepared.images); root = result.id;
  const data = await feed(), item = data.items.find(item => item.id === root)!;
  assert.equal(item.verified, false); assert.equal(item.rating, null); assert.equal(item.images.length, 1);
  assert.match(item.comment, /<script>/); assert.equal(data.canRate, true);
  attachment = item.images[0].id;
  const meta = await sharp(await readDiscussionImage(attachment)).metadata(); assert.equal(meta.format, "webp");
});
test("4: Like requests are idempotent per account and persist in the feed", async () => {
  actor(stranger);
  await Promise.all([changeDiscussion({ id: root, action: "like", liked: true }), changeDiscussion({ id: root, action: "like", liked: true })]);
  const item = (await feed()).items.find(item => item.id === root)!;
  assert.equal(item.likeCount, 1); assert.equal(item.liked, true);
});
test("5: Shop reply is persisted as an official nested thread", async () => {
  actor(admin, "ADMIN");
  const result = await publishDiscussion({ productSlug: marker, comment: "TEST AUREL cảm ơn bạn!", parentId: root }, []); reply = result.id;
  const item = (await feed()).items.find(item => item.id === reply)!;
  assert.equal(item.parentId, root); assert.equal(item.depth, 1); assert.equal(item.rootId, root); assert.equal(item.official, true);
  mkdirSync(".local/discussion-redesign", { recursive: true });
  actor(buyer);
  writeFileSync(".local/discussion-redesign/ui-fixture.json", JSON.stringify(await feed()));
  writeFileSync(".local/discussion-redesign/photo.webp", await readDiscussionImage(attachment));
});
test("6: Another customer cannot delete the author's comment", async () => {
  actor(stranger);
  await assert.rejects(changeDiscussion({ id: root }, true), { status: 403 });
  assert.ok((await feed()).items.some(item => item.id === root));
});
test("7: Shop moderation hides the whole thread and revokes its image URL", async () => {
  actor(admin, "ADMIN");
  await changeDiscussion({ id: root, action: "hide" });
  const data = await feed(); assert.ok(!data.items.some(item => item.id === root || item.id === reply));
  await assert.rejects(readDiscussionImage(attachment), { status: 404 });
});
test("8: Delivered buyer's rating updates the full histogram and five-star filter", async () => {
  actor(buyer);
  await publishDiscussion({ productSlug: marker, comment: "TEST Phom đẹp và vải mềm.", rating: 5 }, []);
  const data = await feed({ five: "1", verified: "1" });
  assert.deepEqual(data.summary, { average: 5, count: 1, distribution: [0, 0, 0, 0, 1] });
  assert.equal(data.items.length, 1); assert.equal(data.items[0].verified, true); assert.equal(data.items[0].rating, 5); assert.equal(data.canRate, false);
});

test("Open: non-buyer rating is saved and counted without a purchased badge", async () => {
  actor(customer);
  assert.equal((await feed()).canRate, true);
  const result = await publishDiscussion({ productSlug: marker, rating: 4, comment: "TEST Đánh giá không cần mua hàng" }, []);
  const data = await feed(), item = data.items.find(item => item.id === result.id)!;
  assert.equal(item.rating, 4); assert.equal(item.verified, false);
  assert.deepEqual(data.summary, { average: 4, count: 1, distribution: [0, 0, 0, 1, 0] });
  assert.equal((await db.query(`SELECT "orderItemId" FROM "ProductReview" WHERE id=$1`, [item.reviewId])).rows[0].orderItemId, null);
});
test("Open: guest still cannot submit a rating", async () => {
  state.discussionActor = null;
  await assert.rejects(publishDiscussion({ productSlug: marker, rating: 5, comment: "TEST Guest" }, []), { status: 401 });
});
test("Open: delivered customer keeps the verified purchased badge", async () => {
  actor(buyer);
  const result = await publishDiscussion({ productSlug: marker, rating: 5, comment: "TEST Khách đã nhận hàng" }, []);
  assert.equal((await feed()).items.find(item => item.id === result.id)!.verified, true);
});
