import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import { logger } from "@ctrlplane/logger";

import { AgentSocket } from "./agent-socket";
import { agents, users } from "./sockets";
import { UserSocket } from "./user-socket";

const onConnect = async (ws: WebSocket, request: IncomingMessage) => {
  const agent = await AgentSocket.from(ws, request);
  if (agent != null) {
    logger.info("Agent connected", {
      resourceId: agent.resource.id,
      name: agent.resource.name,
    });
    agents.set(agent.resource.id, agent);
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

  logger.warn("Connection rejected - neither agent nor user");
  ws.close();
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
