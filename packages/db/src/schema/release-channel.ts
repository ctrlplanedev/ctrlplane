import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environmentPolicy } from "./environment.js";
import { releaseChannel } from "./release.js";

export const environmentPolicyReleaseChannel = pgTable(
  "environment_policy_deployment_version_channel",
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
