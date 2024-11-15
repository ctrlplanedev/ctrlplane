import { createServer } from "node:http";
import type { Express } from "express";

import { controllerOnUpgrade } from "./controller/index.js";
import { sessionOnUpgrade } from "./sessions/index.js";

export const addSocket = (expressApp: Express) => {
  const server = createServer(expressApp);
  server.on("upgrade", (request, socket, head) => {
    if (request.url == null) {
      socket.destroy();
      return;
    }

    const { pathname } = new URL(request.url, "ws://base.ws");
    if (pathname.startsWith("/api/v1/resources/proxy/session")) {
      sessionOnUpgrade(request, socket, head);
      return;
    }

    if (pathname.startsWith("/api/v1/resources/proxy/controller")) {
      controllerOnUpgrade(request, socket, head);
      return;
    }
    socket.destroy();
  });
  return server;
};
