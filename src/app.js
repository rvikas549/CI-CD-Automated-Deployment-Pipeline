const express = require("express");
const app = express();

app.use(express.json());

const AI_TOOLS = [
  {
    id: 1,
    name: "Claude",
    company: "Anthropic",
    category: "LLM / Assistant",
    description: "AI assistant for analysis, writing, and coding",
    url: "https://claude.ai",
  },
  {
    id: 2,
    name: "ChatGPT",
    company: "OpenAI",
    category: "LLM / Assistant",
    description: "Conversational AI for a wide range of tasks",
    url: "https://chat.openai.com",
  },
  {
    id: 3,
    name: "GitHub Copilot",
    company: "GitHub / OpenAI",
    category: "Code Assistant",
    description: "AI pair programmer for VS Code and JetBrains",
    url: "https://github.com/features/copilot",
  },
  {
    id: 4,
    name: "Midjourney",
    company: "Midjourney Inc.",
    category: "Image Generation",
    description: "AI art generator via Discord prompts",
    url: "https://www.midjourney.com",
  },
  {
    id: 5,
    name: "Gemini",
    company: "Google",
    category: "LLM / Assistant",
    description: "Google's multimodal AI across apps and APIs",
    url: "https://gemini.google.com",
  },
  {
    id: 6,
    name: "Cursor",
    company: "Anysphere",
    category: "Code Assistant",
    description: "AI-first code editor built on VS Code",
    url: "https://www.cursor.com",
  },
  {
    id: 7,
    name: "Perplexity",
    company: "Perplexity AI",
    category: "Search / Research",
    description: "AI-powered search engine with cited answers",
    url: "https://www.perplexity.ai",
  },
  {
    id: 8,
    name: "Stable Diffusion",
    company: "Stability AI",
    category: "Image Generation",
    description: "Open-source text-to-image diffusion model",
    url: "https://stability.ai",
  },
];

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// GET all tools (with optional ?category= filter)
app.get("/api/tools", (req, res) => {
  const { category } = req.query;
  const tools = category
    ? AI_TOOLS.filter(
        (t) => t.category.toLowerCase() === category.toLowerCase()
      )
    : AI_TOOLS;

  res.json({
    success: true,
    count: tools.length,
    data: tools,
  });
});

// GET single tool by ID
app.get("/api/tools/:id", (req, res) => {
  const tool = AI_TOOLS.find((t) => t.id === parseInt(req.params.id));
  if (!tool) return res.status(404).json({ success: false, error: "Tool not found" });
  res.json({ success: true, data: tool });
});

// GET unique categories
app.get("/api/categories", (req, res) => {
  const categories = [...new Set(AI_TOOLS.map((t) => t.category))];
  res.json({ success: true, data: categories });
});

// Root
app.get("/", (req, res) => {
  res.json({
    message: "AI Tools API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      allTools: "GET /api/tools",
      filterByCategory: "GET /api/tools?category=<name>",
      singleTool: "GET /api/tools/:id",
      categories: "GET /api/categories",
    },
  });
});

module.exports = app;
