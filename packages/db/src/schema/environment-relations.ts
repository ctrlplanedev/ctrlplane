import { relations } from "drizzle-orm";

import {
  environment,
  environmentMetadata,
  environmentPolicy,
} from "./environment.js";
import { environmentReleaseChannel } from "./release-channel.js";
import { system } from "./system.js";
import { variableSetEnvironment } from "./variable-sets.js";

export const environmentRelations = relations(environment, ({ many, one }) => ({
  policy: one(environmentPolicy, {
    fields: [environment.policyId],
    references: [environmentPolicy.id],
  }),
  releaseChannels: many(environmentReleaseChannel),
  environments: many(variableSetEnvironment),
  system: one(system, {
    fields: [environment.systemId],
    references: [system.id],
  }),
  metadata: many(environmentMetadata),
}));

export const environmentMetadataRelations = relations(
  environmentMetadata,
  ({ one }) => ({
    environment: one(environment, {
      fields: [environmentMetadata.environmentId],
      references: [environment.id],
    }),
  }),
);
