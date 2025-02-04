import { relations } from "drizzle-orm";

import { environmentPolicy } from "./environment.js";
import { environmentPolicyReleaseChannel } from "./release-channel.js";
import { releaseChannel } from "./release.js";

export const releaseChannelRelations = relations(
  releaseChannel,
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
    releaseChannel: one(releaseChannel, {
      fields: [environmentPolicyReleaseChannel.channelId],
      references: [releaseChannel.id],
    }),
  }),
);
