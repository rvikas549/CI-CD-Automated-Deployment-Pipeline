const express = require("express");
const client = require("prom-client");

const app = express();
app.use(express.json());

// ── Prometheus Metrics Setup ────────────────────────────────────────────────
const register = new client.Registry();

// Collect default Node.js metrics (event loop, memory, CPU, GC)
client.collectDefaultMetrics({ register });

// Custom metric: count HTTP requests by method, route, status
const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// Custom metric: track response duration
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Middleware: record every request
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestCounter.labels(req.method, route, res.statusCode).inc();
    httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
  });
  next();
});

// ── AI Tools Data ───────────────────────────────────────────────────────────
const AI_TOOLS = [
  { id: 1, name: "Claude", company: "Anthropic", category: "LLM / Assistant", description: "AI assistant for analysis, writing, and coding", url: "https://claude.ai" },
  { id: 2, name: "ChatGPT", company: "OpenAI", category: "LLM / Assistant", description: "Conversational AI for a wide range of tasks", url: "https://chat.openai.com" },
  { id: 3, name: "GitHub Copilot", company: "GitHub / OpenAI", category: "Code Assistant", description: "AI pair programmer for VS Code and JetBrains", url: "https://github.com/features/copilot" },
  { id: 4, name: "Midjourney", company: "Midjourney Inc.", category: "Image Generation", description: "AI art generator via Discord prompts", url: "https://www.midjourney.com" },
  { id: 5, name: "Gemini", company: "Google", category: "LLM / Assistant", description: "Google's multimodal AI across apps and APIs", url: "https://gemini.google.com" },
  { id: 6, name: "Cursor", company: "Anysphere", category: "Code Assistant", description: "AI-first code editor built on VS Code", url: "https://www.cursor.com" },
  { id: 7, name: "Perplexity", company: "Perplexity AI", category: "Search / Research", description: "AI-powered search engine with cited answers", url: "https://www.perplexity.ai" },
  { id: 8, name: "Stable Diffusion", company: "Stability AI", category: "Image Generation", description: "Open-source text-to-image diffusion model", url: "https://stability.ai" },
];

// ── Routes ──────────────────────────────────────────────────────────────────

// Prometheus metrics endpoint — Prometheus scrapes this every 15s
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString(), version: process.env.npm_package_version || "1.0.0" });
});

// All tools
app.get("/api/tools", (req, res) => {
  const { category } = req.query;
  const tools = category ? AI_TOOLS.filter((t) => t.category.toLowerCase() === category.toLowerCase()) : AI_TOOLS;
  res.json({ success: true, count: tools.length, data: tools });
});

// Single tool
app.get("/api/tools/:id", (req, res) => {
  const tool = AI_TOOLS.find((t) => t.id === parseInt(req.params.id));
  if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });
  res.json({ success: true, data: tool });
});

// Categories
app.get("/api/categories", (req, res) => {
  const categories = [...new Set(AI_TOOLS.map((t) => t.category))];
  res.json({ success: true, data: categories });
});

// Root
app.get("/", (req, res) => {
  res.json({ message: "AI Tools API", version: "1.0.0", endpoints: { health: "GET /health", metrics: "GET /metrics", allTools: "GET /api/tools", filterByCategory: "GET /api/tools?category=<name>", singleTool: "GET /api/tools/:id", categories: "GET /api/categories" } });
});

module.exports = app;

// const express = require("express");
// const app = express();

// app.use(express.json());

// const AI_TOOLS = [
//   {
//     id: 1,
//     name: "Claude",
//     company: "Anthropic",
//     category: "LLM / Assistant",
//     description: "AI assistant for analysis, writing, and coding",
//     url: "https://claude.ai",
//   },
//   {
//     id: 2,
//     name: "ChatGPT",
//     company: "OpenAI",
//     category: "LLM / Assistant",
//     description: "Conversational AI for a wide range of tasks",
//     url: "https://chat.openai.com",
//   },
//   {
//     id: 3,
//     name: "GitHub Copilot",
//     company: "GitHub / OpenAI",
//     category: "Code Assistant",
//     description: "AI pair programmer for VS Code and JetBrains",
//     url: "https://github.com/features/copilot",
//   },
//   {
//     id: 4,
//     name: "Midjourney",
//     company: "Midjourney Inc.",
//     category: "Image Generation",
//     description: "AI art generator via Discord prompts",
//     url: "https://www.midjourney.com",
//   },
//   {
//     id: 5,
//     name: "Gemini",
//     company: "Google",
//     category: "LLM / Assistant",
//     description: "Google's multimodal AI across apps and APIs",
//     url: "https://gemini.google.com",
//   },
//   {
//     id: 6,
//     name: "Cursor",
//     company: "Anysphere",
//     category: "Code Assistant",
//     description: "AI-first code editor built on VS Code",
//     url: "https://www.cursor.com",
//   },
//   {
//     id: 7,
//     name: "Perplexity",
//     company: "Perplexity AI",
//     category: "Search / Research",
//     description: "AI-powered search engine with cited answers",
//     url: "https://www.perplexity.ai",
//   },
//   {
//     id: 8,
//     name: "Stable Diffusion",
//     company: "Stability AI",
//     category: "Image Generation",
//     description: "Open-source text-to-image diffusion model",
//     url: "https://stability.ai",
//   },
// ];

// // Health check
// app.get("/health", (req, res) => {
//   res.json({
//     status: "ok",
//     uptime: process.uptime(),
//     timestamp: new Date().toISOString(),
//     version: process.env.npm_package_version || "1.0.0",
//   });
// });

// // GET all tools (with optional ?category= filter)
// app.get("/api/tools", (req, res) => {
//   const { category } = req.query;
//   const tools = category
//     ? AI_TOOLS.filter(
//         (t) => t.category.toLowerCase() === category.toLowerCase()
//       )
//     : AI_TOOLS;

//   res.json({
//     success: true,
//     count: tools.length,
//     data: tools,
//   });
// });

// // GET single tool by ID
// app.get("/api/tools/:id", (req, res) => {
//   const tool = AI_TOOLS.find((t) => t.id === parseInt(req.params.id));
//   if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });
//   res.json({ success: true, data: tool });
// });

// // GET unique categories
// app.get("/api/categories", (req, res) => {
//   const categories = [...new Set(AI_TOOLS.map((t) => t.category))];
//   res.json({ success: true, data: categories });
// });

// // Root
// app.get("/", (req, res) => {
//   res.json({
//     message: "AI Tools API",
//     version: "1.0.0",
//     endpoints: {
//       health: "GET /health",
//       allTools: "GET /api/tools",
//       filterByCategory: "GET /api/tools?category=<name>",
//       singleTool: "GET /api/tools/:id",
//       categories: "GET /api/categories",
//     },
//   });
// });

// module.exports = app;
