/* eslint-disable @typescript-eslint/no-base-to-string */
import { createServer } from "node:http";
import type { Express } from "express";
import type { IncomingMessage } from "node:http";
import type { RawData } from "ws";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { WebShellInstance } from "@ctrlplane/db/schema";

import { getSession } from "./auth";
import { isEventShellCreate, isEventShellData } from "./events";

const clients: Record<string, WebSocket> = {};
const instanceClients: Record<string, WebSocket> = {};

const onInstanceClose = (instance: { id: string; name: string }) => () => {
  db.update(WebShellInstance)
    .set({ isConnected: false, lastDisconnectedAt: new Date() })
    .where(eq(WebShellInstance.id, instance.id))
    .execute()
    .catch(console.error);

  console.log(`Instance disconnected: ${instance.name} (${instance.id})`);
  delete instanceClients[instance.id];
};

const onInstanceMessage =
  (_: { id: string; name: string }) => (data: RawData) => {
    const event = JSON.parse(data.toString());
    if (!isEventShellData(event)) return;
    const client = clients[event.clientId];
    client?.send(JSON.stringify(event));
  };

const onClientClose = (id: string) => () => {
  console.log(`Client disconnected: ${id}`);
  delete clients[id];
};

const onClientMessage = (data: RawData) => {
  const event = JSON.parse(data.toString());
  if (!isEventShellCreate(event) && !isEventShellData(event)) return;
  const instance = instanceClients[event.instanceId];
  instance?.send(JSON.stringify(event));
};

const onConnect = async (ws: WebSocket, request: IncomingMessage) => {
  if (request.url == null) return ws.close();

  const { headers } = request;
  const instanceApiKey = headers["x-identifier"]?.toString();
  if (instanceApiKey != null) {
    const instance = await db
      .select()
      .from(WebShellInstance)
      .where(eq(WebShellInstance.apiKey, instanceApiKey))
      .execute()
      .then(takeFirst);

    db.update(WebShellInstance)
      .set({ isConnected: true, lastConnectedAt: new Date() })
      .where(eq(WebShellInstance.id, instance.id))
      .execute()
      .catch(console.error);

    console.log(`Instance connected: ${instance.name} (${instance.id})`);
    instanceClients[instance.id] = ws;

    ws.on("message", onInstanceMessage(instance));
    ws.on("close", onInstanceClose(instance));
    return;
  }

  const session = await getSession(request);
  if (session == null) return ws.close(); // Unauthorized

  const { user } = session;
  if (user == null) return ws.close(); // Unauthorized

  const clientId = user.id;
  if (clientId == null) return ws.close(); // Unauthorized

  console.log(`Client connected: ${user.name ?? user.email} (${clientId})`);
  clients[clientId] = ws;
  ws.on("message", onClientMessage);
  ws.on("close", onClientClose(clientId));
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
    if (pathname !== "/webshell/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  wss.on("connection", (ws, request) => onConnect(ws, request));

  return server;
};
