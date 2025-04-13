import { createServer } from "node:http";

import { logger } from "@ctrlplane/logger";

import { env } from "./config.js";
import { workers } from "./workers/index.js";

console.log("Registering instrumentation...");

const shutdown = () => {
  logger.warn("Exiting...");
  Promise.all(Object.values(workers).map((w) => w?.close())).then(() =>
    process.exit(0),
  );
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = env.PORT;
server.listen(port, () => {
  logger.info(`Health check endpoint listening on port ${port}`);
});
