import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

import { getSession } from "./auth";

export class UserSocket {
  static async from(socket: WebSocket, request: IncomingMessage) {
    const session = await getSession(request);
    if (session == null) return null;

    const { user } = session;
    if (user == null) return null;

    console.log(`${user.name ?? user.email} (${user.id}) connected`);
    return new UserSocket(socket, request);
  }

  readonly id: string;

  private constructor(
    private readonly socket: WebSocket,
    private readonly request: IncomingMessage,
  ) {
    this.id = uuidv4();
  }
}
