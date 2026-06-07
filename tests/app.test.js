const request = require("supertest");
const app = require("../src/app");

describe("AI Tools API", () => {
  // ── Root ──────────────────────────────────────────────────────────────────
  describe("GET /", () => {
    it("returns API metadata", async () => {
      const res = await request(app).get("/");
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("message", "AI Tools API");
      expect(res.body).toHaveProperty("endpoints");
    });
  });

  // ── Health ────────────────────────────────────────────────────────────────
  describe("GET /health", () => {
    it("returns status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body).toHaveProperty("uptime");
    });
  });

  // ── All Tools ─────────────────────────────────────────────────────────────
  describe("GET /api/tools", () => {
    it("returns all tools", async () => {
      const res = await request(app).get("/api/tools");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBeGreaterThan(0);
    });

    it("filters tools by category", async () => {
      const res = await request(app).get("/api/tools?category=LLM%20/%20Assistant");
      expect(res.statusCode).toBe(200);
      expect(res.body.data.every((t) => t.category === "LLM / Assistant")).toBe(true);
    });

    it("returns empty array for unknown category", async () => {
      const res = await request(app).get("/api/tools?category=nonexistent");
      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  // ── Single Tool ───────────────────────────────────────────────────────────
  describe("GET /api/tools/:id", () => {
    it("returns a tool by ID", async () => {
      const res = await request(app).get("/api/tools/1");
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("name", "Claude");
    });

    it("returns 404 for missing tool", async () => {
      const res = await request(app).get("/api/tools/9999");
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ── Categories ────────────────────────────────────────────────────────────
  describe("GET /api/categories", () => {
    it("returns unique categories", async () => {
      const res = await request(app).get("/api/categories");
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // No duplicates
      const unique = [...new Set(res.body.data)];
      expect(unique.length).toBe(res.body.data.length);
    });
  });
});
