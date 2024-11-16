import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";

import { logger } from "@ctrlplane/logger";

import { sessionServers } from "./servers.js";

const MAX_HISTORY_BYTES = 1024;

interface MessageHistory {
  messages: Buffer[];
  totalSize: number;
}

const createMessageHistory = (): MessageHistory => ({
  messages: [],
  totalSize: 0,
});

const addMessageToHistory = (history: MessageHistory, msg: Buffer) => {
  history.messages.push(msg);
  history.totalSize += msg.length;

  while (history.totalSize > MAX_HISTORY_BYTES && history.messages.length > 0) {
    const oldMsg = history.messages.shift();
    if (oldMsg) {
      history.totalSize -= oldMsg.length;
    }
  }
};

export const createSessionSocket = (sessionId: string) => {
  logger.info("Creating session socket", { sessionId });
  const wss = new WebSocketServer({ noServer: true });
  sessionServers.set(sessionId, wss);

  // Store messages up to 1024 bytes to replay to new clients
  const messageHistory = createMessageHistory();

  wss.on("connection", (ws) => {
    logger.info("Session connection established", { sessionId });

    // Send message history to new client
    messageHistory.messages.forEach((msg) => {
      ws.send(msg);
    });

    ws.on("message", (msg) => {
      const msgBuffer = Buffer.from(msg as Buffer);
      addMessageToHistory(messageHistory, msgBuffer);
      wss.clients.forEach((client) => {
        if (client !== ws) client.send(msg);
      });
    });

    ws.on("close", () => {
      logger.info("Session connection closed", { sessionId });
      sessionServers.delete(sessionId);
    });
  });

  return wss;
};

const getSessionId = (request: IncomingMessage) => {
  if (request.url == null) return null;

  const { pathname } = new URL(request.url, "ws://base.ws");
  const sessionId = pathname.split("/").at(-1);
  logger.info("Extracted session ID from path", { sessionId });

  return sessionId === "" ? null : sessionId;
};

export const sessionOnUpgrade = (
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => {
  const sessionId = getSessionId(request);
  if (sessionId == null) {
    logger.warn("Session upgrade rejected - no session ID", {
      url: request.url,
    });
    socket.destroy();
    return;
  }

  const wss = sessionServers.get(sessionId);
  if (wss == null) {
    logger.warn("Session upgrade rejected - session not found", { sessionId });
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws, req) => {
    wss.emit("connection", ws, req);
  });
};
