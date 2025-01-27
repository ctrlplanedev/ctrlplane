import { relations } from "drizzle-orm";

import { environmentPolicy } from "./environment-policy.js";
import { environment } from "./environment.js";
import { environmentPolicyReleaseChannel } from "./release-channel.js";

export const environmentPolicyRelations = relations(
  environmentPolicy,
  ({ many }) => ({
    environmentPolicyReleaseChannels: many(environmentPolicyReleaseChannel),
    environments: many(environment),
  }),
);
