import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Authentication middleware", () => {
  it("returns 401 when Authorization header is absent", async () => {
    const res = await request(app).get("/api/users/me");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 for a malformed Bearer token", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer not.a.valid.jwt");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when scheme is not Bearer", async () => {
    const res = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    expect(res.status).toBe(401);
  });

  it("returns 401 on protected routes (activities)", async () => {
    const res = await request(app).get("/api/activities");
    expect(res.status).toBe(401);
  });

  it("returns 401 on protected routes (connections)", async () => {
    const res = await request(app).get("/api/connections");
    expect(res.status).toBe(401);
  });
});
