import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.js";

describe("health routes", () => {
  beforeEach(() => {
    process.env.DATABASE_URL ??=
      "postgresql://nimiqearn:nimiqearn@localhost:5432/nimiqearn";
    process.env.NODE_ENV = "test";
    process.env.APP_ENV = "development";
    process.env.PORT = "3099";
    process.env.LOG_LEVEL = "error";
  });

  afterEach(async () => {
    // closed in each test
  });

  it("GET /health returns ok", async () => {
    const { app } = await buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "nimiqearn-api",
    });

    await app.close();
  });

  it("GET / returns API info", async () => {
    const { app } = await buildServer();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "NimiqEarn Quest API" });

    await app.close();
  });
});
