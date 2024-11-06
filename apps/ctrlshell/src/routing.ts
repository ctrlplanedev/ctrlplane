import { createServer } from "node:http";
import type { Express } from "express";
import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import { AgentSocket } from "./agent-socket";
import { agents, users } from "./sockets";
import { UserSocket } from "./user-socket";

const onConnect = async (ws: WebSocket, request: IncomingMessage) => {
  const agent = AgentSocket.from(ws, request);
  if (agent != null) {
    agents.set(agent.id, agent);
    return;
  }

  const user = await UserSocket.from(ws, request);
  if (user != null) {
    users.set(user.id, user);
    return;
  }

  ws.close();
};

export const addSocket = (expressApp: Express) => {
  const server = createServer(expressApp);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url == null) {
      socket.destroy();
      return;
    }

    const { pathname } = new URL(request.url, "ws://base.ws");
    if (pathname !== "/api/shell/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  wss.on("connection", onConnect);

  return server;
};
