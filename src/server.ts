import fastify from "fastify";
import multipart from "@fastify/multipart";
import "dotenv/config";
import routes from "./routes/index";

const app = fastify({ logger: true });

// Register multipart support for file uploads (50MB limit)
app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Register our API routes
app.register(routes);

// Health check endpoint
app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "3000", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
