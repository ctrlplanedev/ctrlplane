import { relations } from "drizzle-orm";

import { environment, environmentPolicy } from "./environment.js";

export const environmentPolicyRelations = relations(
  environmentPolicy,
  ({ many }) => ({
    environments: many(environment),
  }),
);
