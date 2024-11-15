import type { IncomingMessage } from "node:http";
import type WebSocket from "ws";

import { logger } from "@ctrlplane/logger";
import { sessionCreate, sessionResize } from "@ctrlplane/validators/session";

import { getSession } from "../auth.js";
import { createSessionSocket } from "../sessions/index.js";
import { agents } from "./sockets.js";
import { ifMessage } from "./utils.js";

type User = { id: string };

export class UserSocket {
  static async from(socket: WebSocket, request: IncomingMessage) {
    const session = await getSession(request);
    if (session == null) {
      logger.warn("User connection rejected - no session found");
      return null;
    }

    const { user } = session;
    if (user == null) {
      logger.error("User connection rejected - no user in session");
      return null;
    }
    if (user.id == null) {
      logger.error("User connection rejected - no user ID");
      return null;
    }

    logger.info(`User connection accepted ${user.email}`, {
      userId: user.id,
    });
    return new UserSocket(socket, request, { id: user.id });
  }

  private constructor(
    private readonly socket: WebSocket,
    private readonly _: IncomingMessage,
    public readonly user: User,
  ) {
    this.socket.on(
      "message",
      ifMessage()
        .is(sessionCreate, (data) => {
          logger.debug("Received session create request", {
            targetId: data.targetId,
            sessionId: data.sessionId,
            userId: user.id,
          });

          const agent = agents.get(data.targetId);
          if (agent == null) {
            logger.warn("Agent not found for session create", {
              targetId: data.targetId,
              sessionId: data.sessionId,
              userId: user.id,
            });
            return;
          }

          logger.info("Found agent for session create", {
            targetId: data.targetId,
          });

          createSessionSocket(data.sessionId);
          agent.send(data);
        })
        .is(sessionResize, (data) => {
          const { sessionId, targetId } = data;
          logger.info("Received session resize request", {
            sessionId: data.sessionId,
            userId: user.id,
          });

          const agent = agents.get(targetId);
          if (agent == null) {
            logger.warn("Agent not found for session resize", {
              targetId,
              sessionId,
            });
            return;
          }

          agent.send(data);
        })
        .handle(),
    );
  }
}
