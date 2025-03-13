import { relations } from "drizzle-orm";

import { environmentPolicy } from "./environment.js";
import { environmentPolicyReleaseChannel } from "./release-channel.js";
import { deploymentVersionChannel } from "./release.js";

export const releaseChannelRelations = relations(
  deploymentVersionChannel,
  ({ many }) => ({
    environmentPolicyReleaseChannels: many(environmentPolicyReleaseChannel),
  }),
);

export const environmentPolicyReleaseChannelRelations = relations(
  environmentPolicyReleaseChannel,
  ({ one }) => ({
    environmentPolicy: one(environmentPolicy, {
      fields: [environmentPolicyReleaseChannel.policyId],
      references: [environmentPolicy.id],
    }),
    releaseChannel: one(deploymentVersionChannel, {
      fields: [environmentPolicyReleaseChannel.channelId],
      references: [deploymentVersionChannel.id],
    }),
  }),
);
