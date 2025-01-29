import { relations } from "drizzle-orm";

import { environment, environmentPolicy } from "./environment.js";
import {
  environmentPolicyReleaseChannel,
  environmentReleaseChannel,
} from "./release-channel.js";
import { releaseChannel } from "./release.js";

export const releaseChannelRelations = relations(
  releaseChannel,
  ({ many }) => ({
    environmentReleaseChannels: many(environmentReleaseChannel),
    environmentPolicyReleaseChannels: many(environmentPolicyReleaseChannel),
  }),
);

export const environmentReleaseChannelRelations = relations(
  environmentReleaseChannel,
  ({ one }) => ({
    environment: one(environment, {
      fields: [environmentReleaseChannel.environmentId],
      references: [environment.id],
    }),
    releaseChannel: one(releaseChannel, {
      fields: [environmentReleaseChannel.channelId],
      references: [releaseChannel.id],
    }),
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
