import type { ResourceToInsert } from "@ctrlplane/job-dispatch";
import type {
  SessionCreate,
  SessionDelete,
  SessionResize,
} from "@ctrlplane/validators/session";
import type { IncomingMessage } from "http";
import type WebSocket from "ws";
import type { MessageEvent } from "ws";

import { can, getUser } from "@ctrlplane/auth/utils";
import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { deleteResources, upsertResources } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";
import { agentConnect, agentHeartbeat } from "@ctrlplane/validators/session";

import { agents } from "./sockets.js";
import { ifMessage } from "./utils.js";

export class AgentSocket {
  static async from(socket: WebSocket, request: IncomingMessage) {
    const name = request.headers["x-agent-name"]?.toString();
    if (name == null) {
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
      logger.error("Agent connection rejected - workspace not found", {
        workspaceSlug,
      });
      return null;
    }

    const user = await getUser(apiKey);
    if (user == null) {
      logger.error("Agent connection rejected - invalid API key", { apiKey });
      throw new Error("Invalid API key.");
    }

    const hasAccess = await can()
      .user(user.id)
      .perform(Permission.ResourceCreate)
      .on({ type: "workspace", id: workspace.id });

    if (!hasAccess) {
      logger.error(
        `Agent connection rejected - user (${user.email}) does not have access ` +
          `to create resources in workspace (${workspace.slug})`,
        { user, workspace },
      );
      throw new Error("User does not have access.");
    }

    const agent = new AgentSocket(socket, name, workspace.id);
    await agent.updateResource({});
    return agent;
  }

  resource: ResourceToInsert | null = null;

  private constructor(
    private readonly socket: WebSocket,
    private readonly name: string,
    private readonly workspaceId: string,
  ) {
    this.socket.on(
      "message",
      ifMessage()
        .is(agentConnect, (data) => {
          this.updateResource({
            updatedAt: new Date(),
            config: data.config,
            metadata: data.metadata,
          });
        })
        .is(agentHeartbeat, () =>
          this.updateResource({
            updatedAt: new Date(),
            metadata: {
              ...(this.resource?.metadata ?? {}),
              ["last-heartbeat"]: new Date().toISOString(),
            },
          }),
        )
        .handle(),
    );

    this.socket.on("close", () => {
      logger.info("Agent disconnected", { agentName: this.name });
      if (this.resource?.id == null) return;

      agents.delete(this.resource.id);
      deleteResources(db, [this.resource.id]);
    });
  }

  async updateResource(
    resource: Omit<
      Partial<ResourceToInsert>,
      "name" | "version" | "kind" | "identifier" | "workspaceId"
    >,
  ) {
    const [res] = await upsertResources(db, [
      {
        ...resource,
        name: this.name,
        version: "ctrlplane.access/v1",
        kind: "AccessNode",
        identifier: `ctrlplane/access/access-node/${this.name}`,
        workspaceId: this.workspaceId,
      },
    ]);
    if (res == null) throw new Error("Failed to create resource");
    this.resource = res;
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

  send(data: SessionCreate | SessionDelete | SessionResize) {
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
