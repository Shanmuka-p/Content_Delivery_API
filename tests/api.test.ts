import test from "node:test";
import assert from "node:assert";

const API_URL = "http://localhost:3000";

test("Content Delivery API Core Flow", async (t) => {
  let assetId = "";
  let assetEtag = "";

  await t.test("1. Upload an Asset", async () => {
    const formData = new FormData();
    const blob = new Blob(["Testing Edge Caching"], { type: "text/plain" });
    formData.append("file", blob, "test.txt");

    const res = await fetch(`${API_URL}/assets/upload`, {
      method: "POST",
      body: formData,
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.ok(data.etag);

    assetId = data.id;
    assetEtag = data.etag;
  });

  await t.test("2. Download Asset (Cache Miss)", async () => {
    const res = await fetch(`${API_URL}/assets/${assetId}/download`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("ETag"), assetEtag);
    assert.ok(res.headers.get("Cache-Control")?.includes("public"));
  });

  await t.test("3. Conditional Request (Cache Hit / 304)", async () => {
    // Simulating the CDN sending the ETag back to the origin
    const res = await fetch(`${API_URL}/assets/${assetId}/download`, {
      headers: { "If-None-Match": assetEtag },
    });

    // It should intercept it and return 304!
    assert.strictEqual(res.status, 304);
  });
});
