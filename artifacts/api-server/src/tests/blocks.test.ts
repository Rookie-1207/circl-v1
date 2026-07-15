import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Block endpoints — auth guard", () => {
  it("GET /api/users/me/blocks requires auth", async () => {
    const res = await request(app).get("/api/users/me/blocks");
    expect(res.status).toBe(401);
  });

  it("POST /api/users/42/block requires auth", async () => {
    const res = await request(app).post("/api/users/42/block");
    expect(res.status).toBe(401);
  });

  it("DELETE /api/users/42/block requires auth", async () => {
    const res = await request(app).delete("/api/users/42/block");
    expect(res.status).toBe(401);
  });
});
