import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });

  it("is not affected by the rate limiter", async () => {
    // Health endpoint is skipped by the rate-limiter; verify it doesn't
    // return 429 even when called rapidly.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get("/api/healthz")),
    );
    for (const res of results) {
      expect(res.status).toBe(200);
    }
  });
});
