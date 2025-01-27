import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environmentPolicy } from "./environment-policy.js";
import { environment } from "./environment.js";
import { releaseChannel } from "./release.js";

export const environmentPolicyReleaseChannel = pgTable(
  "environment_policy_release_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => environmentPolicy.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => releaseChannel.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.policyId, t.channelId),
    deploymentUniq: uniqueIndex().on(t.policyId, t.deploymentId),
  }),
);

export type EnvironmentPolicyReleaseChannel = InferSelectModel<
  typeof environmentPolicyReleaseChannel
>;

export const environmentReleaseChannel = pgTable(
  "environment_release_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => releaseChannel.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.environmentId, t.channelId),
    deploymentUniq: uniqueIndex().on(t.environmentId, t.deploymentId),
  }),
);

export type EnvironmentReleaseChannel = InferSelectModel<
  typeof environmentReleaseChannel
>;
