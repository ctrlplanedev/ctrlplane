import { relations } from "drizzle-orm";

import { environmentPolicy } from "./environment.js";
import { environmentPolicyDeploymentVersionChannel } from "./release-channel.js";
import { deploymentVersionChannel } from "./release.js";

export const releaseChannelRelations = relations(
  deploymentVersionChannel,
  ({ many }) => ({
    environmentPolicyDeploymentVersionChannels: many(
      environmentPolicyDeploymentVersionChannel,
    ),
  }),
);

export const environmentPolicyDeploymentVersionChannelRelations = relations(
  environmentPolicyDeploymentVersionChannel,
  ({ one }) => ({
    environmentPolicy: one(environmentPolicy, {
      fields: [environmentPolicyDeploymentVersionChannel.policyId],
      references: [environmentPolicy.id],
    }),
    deploymentVersionChannel: one(deploymentVersionChannel, {
      fields: [environmentPolicyDeploymentVersionChannel.channelId],
      references: [deploymentVersionChannel.id],
    }),
  }),
);
