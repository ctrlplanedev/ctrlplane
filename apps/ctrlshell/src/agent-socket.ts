import type { IncomingMessage } from "http";
import type WebSocket from "ws";
import type { MessageEvent } from "ws";
import { v4 as uuidv4 } from "uuid";

import type {
  AgentHeartbeat,
  SessionCreate,
  SessionDelete,
  SessionInput,
  SessionOutput,
} from "./payloads";
import { agentHeartbeat, sessionOutput } from "./payloads";
import { ifMessage } from "./utils";

export class AgentSocket {
  static from(socket: WebSocket, request: IncomingMessage) {
    if (request.headers["x-api-key"] == null) return null;
    return new AgentSocket(socket, request);
  }

  private stdoutListeners = new Set<(data: SessionOutput) => void>();
  readonly id: string;

  private constructor(
    private readonly socket: WebSocket,
    private readonly request: IncomingMessage,
  ) {
    this.id = uuidv4();
    this.socket.addEventListener(
      "message",
      ifMessage()
        .is(sessionOutput, (data) => this.notifySubscribers(data))
        .is(agentHeartbeat, (data) => this.updateStatus(data))
        .handle(),
    );
  }

  onSessionStdout(callback: (data: SessionOutput) => void) {
    this.stdoutListeners.add(callback);
  }

  private notifySubscribers(data: SessionOutput) {
    for (const subscriber of this.stdoutListeners) {
      subscriber(data);
    }
  }

  private updateStatus(data: AgentHeartbeat) {
    console.log("status", data.timestamp);
  }

  createSession(username = "", shell = "") {
    const createSession: SessionCreate = {
      type: "session.create",
      username,
      shell,
    };

    this.send(createSession);

    return this.waitForResponse(
      (response) => response.type === "session.created",
    );
  }

  async deleteSession(sessionId: string) {
    const deletePayload: SessionDelete = {
      type: "session.delete",
      sessionId,
    };
    this.send(deletePayload);

    return this.waitForResponse(
      (response) => response.type === "session.delete.success",
    );
  }

  waitForResponse<T>(predicate: (response: any) => boolean, timeoutMs = 5000) {
    return waitForResponse<T>(this.socket, predicate, timeoutMs);
  }

  send(data: SessionCreate | SessionDelete | SessionInput) {
    return this.socket.send(JSON.stringify(data));
  }
}

async function waitForResponse<T>(
  socket: WebSocket,
  predicate: (response: any) => boolean,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error(`Response timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      try {
        const response = JSON.parse(
          typeof event.data === "string" ? event.data : "",
        );
        if (predicate(response)) {
          clearTimeout(timeout);
          socket.removeEventListener("message", onMessage);
          resolve(response);
        }
      } catch {
        clearTimeout(timeout);
        socket.removeEventListener("message", onMessage);
        reject(new Error("Failed to parse response"));
      }
    };

    socket.addEventListener("message", onMessage);
  });
}
