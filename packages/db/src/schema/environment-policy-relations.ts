import { relations } from "drizzle-orm";

import { environment, environmentPolicy } from "./environment.js";
import { environmentPolicyDeploymentVersionChannel } from "./release-channel.js";

export const environmentPolicyRelations = relations(
  environmentPolicy,
  ({ many }) => ({
    environmentPolicyDeploymentVersionChannels: many(
      environmentPolicyDeploymentVersionChannel,
    ),
    environments: many(environment),
  }),
);
