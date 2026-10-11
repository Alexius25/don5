import Fastify from "fastify";

export const app = Fastify({
  logger: true,
});

app.get("/", async () => {
  return { message: "API is running" };
});

app.get("/health", async () => {
  return { status: "ok" };
});