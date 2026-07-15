import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Reports endpoint — auth guard", () => {
  it("POST /api/reports requires auth", async () => {
    const res = await request(app).post("/api/reports").send({
      targetType: "user",
      targetId: 1,
      reason: "Spam",
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/reports without auth returns error object", async () => {
    const res = await request(app).post("/api/reports").send({
      targetType: "user",
      targetId: 1,
      reason: "Spam",
    });
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });
});
