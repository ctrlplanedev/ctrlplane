import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { workspace } from "./workspace.js";

export const versionStatus = pgEnum("deployment_version_status", [
  "unspecified",
  "building",
  "ready",
  "failed",
  "rejected",
  "paused",
]);

export const deploymentVersion = pgTable(
  "deployment_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    tag: text("tag").notNull(),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    jobAgentConfig: jsonb("job_agent_config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    deploymentId: uuid("deployment_id").notNull(),
    status: versionStatus("status").notNull().default("ready"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata")
      .notNull()
      .default("{}")
      .$type<Record<string, string>>(),

    workspaceId: uuid("workspace_id").references(() => workspace.id),
  },
  (t) => [
    uniqueIndex().on(t.deploymentId, t.tag),
    index("deployment_version_created_at_idx").on(t.createdAt),
  ],
);

export const deploymentVersionRelations = relations(
  deploymentVersion,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [deploymentVersion.deploymentId],
      references: [deployment.id],
    }),
  }),
);
