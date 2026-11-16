import test from "node:test";
import assert from "node:assert/strict";
import { postComment, removeComment, type CommentStore } from "../src/features/reviews/comment-use-cases.ts";

test("Account without purchase can publish a comment immediately", async () => {
  const saved: unknown[] = [];
  const store: CommentStore = { async create(...args) { saved.push(args); }, async delete() { return 0; } };
  assert.deepEqual(await postComment({ id: 3, role: "CUSTOMER" }, { productSlug: "aurel", comment: "  Có size S không?  " }, store), { created: true });
  assert.deepEqual(saved, [[3, "aurel", "Có size S không?"]]);
});
test("Guest cannot publish a comment", async () => {
  const store: CommentStore = { async create() { assert.fail("Must not write"); }, async delete() { return 0; } };
  await assert.rejects(postComment(null, { productSlug: "aurel", comment: "test" }, store), { status: 401 });
});
test("Shop can permanently delete another customer's comment", async () => {
  let deleted = false;
  const store: CommentStore = { async create() {}, async delete(id, ownerId) { assert.equal(id, 42); assert.equal(ownerId, null); deleted = true; return 1; } };
  assert.deepEqual(await removeComment({ id: 1, role: "ADMIN" }, { commentId: 42 }, store), { deleted: true });
  assert.equal(deleted, true);
});
