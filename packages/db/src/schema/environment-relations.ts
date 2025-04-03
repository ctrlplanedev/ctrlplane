import { relations } from "drizzle-orm";

import {
  environment,
  environmentMetadata,
  environmentPolicy,
} from "./environment.js";
import { system } from "./system.js";

export const environmentRelations = relations(environment, ({ many, one }) => ({
  policy: one(environmentPolicy, {
    fields: [environment.policyId],
    references: [environmentPolicy.id],
  }),
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
