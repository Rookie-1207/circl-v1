import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Delete account endpoint — auth guard", () => {
  it("DELETE /api/users/me requires auth", async () => {
    const res = await request(app).delete("/api/users/me");
    expect(res.status).toBe(401);
  });

  it("DELETE /api/users/me returns Unauthorized without token", async () => {
    const res = await request(app).delete("/api/users/me");
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });
});
