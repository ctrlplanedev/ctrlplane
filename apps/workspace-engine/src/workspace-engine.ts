import type { EventPayload, Message } from "@ctrlplane/events";

import { logger } from "@ctrlplane/logger";

const log = logger.child({ component: "WorkspaceEngine" });

export class WorkspaceEngine {
  constructor(private workspaceId: string) {}

  async readMessage(message: Buffer<ArrayBufferLike>) {
    try {
      const messageData: Message<keyof EventPayload> = JSON.parse(
        message.toString(),
      );

      log.info("Received message", {
        workspaceId: this.workspaceId,
        message: messageData,
      });

      await Promise.resolve();
    } catch (error) {
      log.error("Error reading message", {
        workspaceId: this.workspaceId,
        error,
      });
    }
  }
}
