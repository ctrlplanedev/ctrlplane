import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { deployment } from "./deployment.js";
import { approvalStatusType } from "./environment.js";
import { release } from "./release.js";
import { resource } from "./resource.js";

export const resourceDeploymentReleases = pgTable(
  "resource_deployment_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    desiredReleaseId: uuid("desired_release_id")
      .notNull()
      .references(() => release.id, {
        onDelete: "cascade",
      }),
    currentReleaseId: uuid("current_release_id").references(() => release.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.resourceId, t.deploymentId) }),
);

const basePolicy = {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  releaseId: uuid("release_id")
    .notNull()
    .references(() => release.id, { onDelete: "cascade" }),
  resourceId: uuid("resource_id")
    .notNull()
    .references(() => resource.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const policyRollout = pgTable(
  "resource_release_policy_after_timestamp",
  {
    ...basePolicy,
    date: timestamp("date", { withTimezone: true, precision: 0 }).notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.releaseId, t.resourceId) }),
);

export const policyApproval = pgTable(
  "resource_release_policy_approval",
  {
    ...basePolicy,
    status: approvalStatusType("status").notNull(),
    updatedBy: uuid("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      precision: 0,
    }).default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.releaseId, t.resourceId) }),
);

export const resourceReleasePolicy = (resourceId: string) => sql<{
  id: string;
  type: string;
  releaseId: string;
  resourceId: string;
  updatedAt: Date;
  state: "passed" | "failed" | "pending";
  date: Date | null;
}>`
  SELECT 
    id,
    'resource_release_policy_after_timestamp' as type,
    release_id as "releaseId",
    resource_id as "resourceId",
    updated_at as "updatedAt",
    CASE 
      WHEN ${policyRollout.date} > now() THEN 'passed'
      WHEN ${policyRollout.date} < now() THEN 'pending'
    END as "state",
  FROM ${policyRollout}
  WHERE resource_id = ${resourceId}

  UNION ALL

  SELECT
    id,
    'resource_release_policy_approval' as type,
    release_id as "releaseId",
    resource_id as "resourceId",
    updated_at as "updatedAt",
    CASE
      WHEN ${policyApproval.status} = 'approved' THEN 'passed'
      WHEN ${policyApproval.status} = 'rejected' THEN 'failed'
      ELSE 'pending'
    END as "state",
  FROM ${policyApproval}
  WHERE resource_id = ${resourceId}
`;
