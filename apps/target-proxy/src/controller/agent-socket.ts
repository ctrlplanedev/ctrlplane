import type { InsertTarget, Target } from "@ctrlplane/db/schema";
import type {
  AgentHeartbeat,
  SessionCreate,
  SessionDelete,
  SessionInput,
  SessionOutput,
  SessionResize,
} from "@ctrlplane/validators/session";
import type { IncomingMessage } from "http";
import type WebSocket from "ws";
import type { MessageEvent } from "ws";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import {
  agentConnect,
  agentHeartbeat,
  sessionOutput,
} from "@ctrlplane/validators/session";

import { ifMessage } from "./utils";

export class AgentSocket {
  static async from(socket: WebSocket, request: IncomingMessage) {
    const agentName = request.headers["x-agent-name"]?.toString();
    if (agentName == null) {
      logger.warn("Agent connection rejected - missing agent name");
      return null;
    }

    const apiKey = request.headers["x-api-key"]?.toString();
    if (apiKey == null) {
      logger.error("Agent connection rejected - missing API key");
      throw new Error("API key is required.");
    }

    const workspaceSlug = request.headers["x-workspace"]?.toString();
    if (workspaceSlug == null) {
      logger.error("Agent connection rejected - missing workspace slug");
      throw new Error("Workspace slug is required.");
    }

    const workspace = await db.query.workspace.findFirst({
      where: eq(schema.workspace.slug, workspaceSlug),
    });
    if (workspace == null) {
      logger.error("Agent connection rejected - workspace not found");
      return null;
    }

    const targetInfo: InsertTarget = {
      name: agentName,
      version: "ctrlplane/v1",
      kind: "TargetSession",
      identifier: `ctrlplane/target-agent/${agentName}`,
      workspaceId: workspace.id,
    };
    const [target] = await upsertTargets(db, [targetInfo]);
    if (target == null) return null;
    return new AgentSocket(socket, request, target);
  }

  private stdoutListeners = new Set<(data: SessionOutput) => void>();

  private constructor(
    private readonly socket: WebSocket,
    private readonly _: IncomingMessage,
    public readonly target: Target,
  ) {
    this.target = target;
    this.socket.on(
      "message",
      ifMessage()
        .is(agentConnect, async (data) => {
          await upsertTargets(db, [
            {
              ...target,
              config: data.config,
              metadata: data.metadata,
              version: "ctrlplane/v1",
            },
          ]);
        })
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

  createSession(session: SessionCreate) {
    this.send(session);
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

  send(data: SessionCreate | SessionDelete | SessionInput | SessionResize) {
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
