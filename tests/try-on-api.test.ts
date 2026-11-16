import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/try-on/route.ts";

test("POST /api/try-on returns 400 when personImage is missing", async () => {
  const form = new FormData();
  form.append("garmentImageUrl", "/images/aurel/collection-demo/knit.png");
  const req = new Request("http://localhost:3000/api/try-on", { method: "POST", body: form });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test("POST /api/try-on returns 400 for unsupported image MIME type", async () => {
  const form = new FormData();
  form.append("personImage", new File([new Uint8Array([1, 2, 3])], "note.txt", { type: "text/plain" }));
  form.append("garmentImageUrl", "/images/aurel/collection-demo/knit.png");
  const req = new Request("http://localhost:3000/api/try-on", { method: "POST", body: form });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test("POST /api/try-on rejects garmentImageUrl path traversal with 400", async () => {
  const form = new FormData();
  form.append("personImage", new File([new Uint8Array([137, 80, 78, 71])], "person.png", { type: "image/png" }));
  form.append("garmentImageUrl", "/../package.json");
  const req = new Request("http://localhost:3000/api/try-on", { method: "POST", body: form });
  const res = await POST(req);
  assert.equal(res.status, 400);
});

test("POST /api/try-on returns 503 when local DM-VTON service is offline", async () => {
  const prev = process.env.TRYON_SERVICE_URL;
  process.env.TRYON_SERVICE_URL = "http://127.0.0.1:59999";
  try {
    const form = new FormData();
    form.append("personImage", new File([new Uint8Array([137, 80, 78, 71])], "person.png", { type: "image/png" }));
    form.append("garmentImageUrl", "/images/aurel/collection-demo/knit.png");
    const req = new Request("http://localhost:3000/api/try-on", { method: "POST", body: form });
    const res = await POST(req);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error?: string };
    assert.ok(body.error && body.error.length > 0);
  } finally {
    if (prev === undefined) delete process.env.TRYON_SERVICE_URL;
    else process.env.TRYON_SERVICE_URL = prev;
  }
});
