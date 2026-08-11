// Integration test: /api/drafts handlers (POST/GET/PUT).
// Calls extracted pure handler functions directly — no dev server, no HTTP fetch.
// Each test uses a randomized sessionId and cleans up the created draft in a
// try/finally so the DB doesn't accumulate across runs.
//
// Env: MONGODB_URI from .env.local via tests/setup-integration.ts.
import { describe, it, expect } from "vitest";
import {
  handleDraftPost,
  handleDraftGet,
  handleDraftPut,
} from "@/lib/drafts-api";
import { getPayload } from "@/lib/payload-client";

async function deleteDraftBySessionId(sessionId: string): Promise<void> {
  const payload = await getPayload();
  const existing = await payload.find({
    collection: "drafts",
    where: { sessionId: { equals: sessionId } },
  });
  for (const doc of existing.docs) {
    await payload.delete({ collection: "drafts", id: doc.id });
  }
}

describe("/api/drafts handlers", () => {
  it("POST then GET roundtrip preserves config", async () => {
    const sessionId = `test-sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const config = { items: ["a", "b"], note: "roundtrip" };

    try {
      const postReq = new Request("http://test/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, config }),
      });
      const postRes = await handleDraftPost(postReq);
      expect(postRes.status).toBe(201);
      const postBody = await postRes.json();
      expect(postBody.sessionId).toBe(sessionId);
      expect(postBody.expiresAt).toBeTruthy();

      const getReq = new Request(`http://test/api/drafts/${sessionId}`, {
        method: "GET",
      });
      const getRes = await handleDraftGet(getReq, {
        params: Promise.resolve({ sessionId }),
      });
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.config).toEqual(config);
      expect(getBody.sessionId).toBe(sessionId);
    } finally {
      await deleteDraftBySessionId(sessionId);
    }
  });

  it("GET on non-existent sessionId returns 404", async () => {
    const sessionId = `nonexistent-${Date.now()}`;
    const req = new Request(`http://test/api/drafts/${sessionId}`, {
      method: "GET",
    });
    const res = await handleDraftGet(req, {
      params: Promise.resolve({ sessionId }),
    });
    expect(res.status).toBe(404);
  });

  it("PUT updates config", async () => {
    const sessionId = `test-put-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initial = { items: ["x"] };
    const updated = { items: ["x", "y", "z"], note: "updated" };

    try {
      const postReq = new Request("http://test/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, config: initial }),
      });
      await handleDraftPost(postReq);

      const putReq = new Request(`http://test/api/drafts/${sessionId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: updated }),
      });
      const putRes = await handleDraftPut(putReq, {
        params: Promise.resolve({ sessionId }),
      });
      expect(putRes.status).toBe(200);
      const putBody = await putRes.json();
      expect(putBody.config).toEqual(updated);
    } finally {
      await deleteDraftBySessionId(sessionId);
    }
  });

  it("POST twice with same sessionId upserts (returns 200)", async () => {
    const sessionId = `test-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const firstReq = new Request("http://test/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, config: { v: 1 } }),
      });
      const firstRes = await handleDraftPost(firstReq);
      expect(firstRes.status).toBe(201);

      const secondReq = new Request("http://test/api/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, config: { v: 2 } }),
      });
      const secondRes = await handleDraftPost(secondReq);
      expect(secondRes.status).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.sessionId).toBe(sessionId);

      // Confirm only one doc exists, with updated config.
      const payload = await getPayload();
      const found = await payload.find({
        collection: "drafts",
        where: { sessionId: { equals: sessionId } },
      });
      expect(found.docs.length).toBe(1);
      expect((found.docs[0].config as { v: number }).v).toBe(2);
    } finally {
      await deleteDraftBySessionId(sessionId);
    }
  });

  it("POST rejects missing sessionId with 400", async () => {
    const req = new Request("http://test/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: {} }),
    });
    const res = await handleDraftPost(req);
    expect(res.status).toBe(400);
  });
});
