import { relations } from "drizzle-orm";

import {
  computedEnvironmentResource,
  environment,
  environmentMetadata,
  environmentPolicy,
} from "./environment.js";
import { resource } from "./resource.js";
import { system } from "./system.js";
import { variableSetEnvironment } from "./variable-sets.js";

export const environmentRelations = relations(environment, ({ many, one }) => ({
  policy: one(environmentPolicy, {
    fields: [environment.policyId],
    references: [environmentPolicy.id],
  }),
  environments: many(variableSetEnvironment),
  system: one(system, {
    fields: [environment.systemId],
    references: [system.id],
  }),
  metadata: many(environmentMetadata),
  computedResources: many(computedEnvironmentResource),
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

export const computedEnvironmentResourceRelations = relations(
  computedEnvironmentResource,
  ({ one }) => ({
    environment: one(environment, {
      fields: [computedEnvironmentResource.environmentId],
      references: [environment.id],
    }),
    resource: one(resource, {
      fields: [computedEnvironmentResource.resourceId],
      references: [resource.id],
    }),
  }),
);
