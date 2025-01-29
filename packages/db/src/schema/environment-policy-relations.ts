import { relations } from "drizzle-orm";

import { environment, environmentPolicy } from "./environment.js";
import { environmentPolicyReleaseChannel } from "./release-channel.js";

export const environmentPolicyRelations = relations(
  environmentPolicy,
  ({ many }) => ({
    environmentPolicyReleaseChannels: many(environmentPolicyReleaseChannel),
    environments: many(environment),
  }),
);
