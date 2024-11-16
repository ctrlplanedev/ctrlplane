import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import { logger } from "@ctrlplane/logger";

import { AgentSocket } from "./agent-socket.js";
import { agents, users } from "./sockets.js";
import { UserSocket } from "./user-socket.js";

const onConnect = async (ws: WebSocket, request: IncomingMessage) => {
  const agent = await AgentSocket.from(ws, request);
  if (agent != null) {
    logger.info("Agent connected");
    if (agent.resource?.id == null) {
      logger.error("Agent resource ID is null");
      ws.close(1008, "Agent resource ID is null");
      throw new Error("Agent resource ID is null");
    }

    agents.set(agent.resource.id, { lastSync: new Date(), agent });
    return;
  }

  const user = await UserSocket.from(ws, request);
  if (user != null) {
    logger.info("User connected", {
      userId: user.user.id,
    });
    users.set(user.user.id, user);
    return;
  }

  const msg = "Neither agent nor user";
  logger.warn(msg);
  ws.close(1008, msg);
};

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws, request) => {
  logger.debug("WebSocket connection established");
  onConnect(ws, request).catch((error) => {
    logger.error("Error handling connection", { error });
    ws.close();
  });
});

export const controllerOnUpgrade = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => {
  logger.debug("WebSocket upgrade request received", {
    url: request.url,
  });

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
};
