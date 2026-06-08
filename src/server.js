const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`[server] AI Tools API running on port ${PORT}`);
  console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received — shutting down gracefully");
  server.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[server] SIGINT received — shutting down gracefully");
  server.close(() => process.exit(0));
});
