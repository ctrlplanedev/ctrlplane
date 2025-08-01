import type { Event, EventPayload, Message } from "@ctrlplane/events";

import { logger } from "@ctrlplane/logger";

import { EnvironmentResourceSelectorEngine } from "./selector-engines/environment-resource-selector-engine.js";

const log = logger.child({ component: "WorkspaceEngine" });

export class WorkspaceEngine {
  private envResourceSelector: EnvironmentResourceSelectorEngine;

  constructor(private workspaceId: string) {
    this.envResourceSelector = new EnvironmentResourceSelectorEngine();
  }

  async handleResourceCreated(resource: EventPayload[Event.ResourceCreated]) {
    this.envResourceSelector.upsertEntity(resource);
    const environments = this.envResourceSelector.getMatchesForEntity(resource);
    log.info("found environments for resource", {
      resourceId: resource.id,
      environments,
    });

    await Promise.resolve();
  }

  async handleEnvironmentCreated(
    environment: EventPayload[Event.EnvironmentCreated],
  ) {
    this.envResourceSelector.upsertSelector(environment);
    const resources =
      this.envResourceSelector.getMatchesForSelector(environment);
    log.info("found resources for environment", {
      environmentId: environment.id,
      resources,
    });

    await Promise.resolve();
  }

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
