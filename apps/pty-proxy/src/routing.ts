import { createServer } from "node:http";
import type { Express } from "express";

import { logger } from "@ctrlplane/logger";

import { controllerOnUpgrade } from "./controller/index.js";
import { sessionOnUpgrade } from "./sessions/index.js";

export const addSocket = (expressApp: Express) => {
  const server = createServer(expressApp);
  logger.info("Created HTTP server for WebSocket upgrades");

  server.on("upgrade", (request, socket, head) => {
    if (request.url == null) {
      logger.warn("WebSocket upgrade rejected - no URL provided");
      socket.destroy();
      return;
    }

    const { pathname } = new URL(request.url, "ws://base.ws");
    logger.debug("Processing WebSocket upgrade path", { pathname });

    if (pathname.startsWith("/api/v1/resources/proxy/session")) {
      logger.info("Upgrading WebSocket connection for session proxy", {
        pathname,
      });
      sessionOnUpgrade(request, socket, head);
      return;
    }

    if (pathname.startsWith("/api/v1/resources/proxy/controller")) {
      logger.info("Upgrading WebSocket connection for controller", {
        pathname,
      });
      controllerOnUpgrade(request, socket, head);
      return;
    }

    logger.warn("WebSocket upgrade rejected - invalid path", { pathname });
    socket.destroy(new Error("Incorrect path for WebSocket upgrade"));
  });

  return server;
};
