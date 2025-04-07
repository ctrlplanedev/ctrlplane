import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { handleExistingResource } from "./existing-resource.js";
import { handleNewResource } from "./new-resource.js";

const log = logger.child({ worker: "upsert-resource" });

export const upsertResourceWorker = createWorker(
  Channel.UpsertResource,
  async (job) => {
    try {
      const { data } = job;
      const { resource } = data;

      const existingResource = await db.query.resource.findFirst({
        where: and(
          eq(SCHEMA.resource.identifier, resource.identifier),
          eq(SCHEMA.resource.workspaceId, resource.workspaceId),
          isNull(SCHEMA.resource.deletedAt),
        ),
        with: { metadata: true, variables: true },
      });
      if (existingResource == null) return handleNewResource(db, resource);

      return handleExistingResource(db, existingResource, resource);
    } catch (error) {
      log.error("Error upserting resource", { error });
      throw error;
    }
  },
);
