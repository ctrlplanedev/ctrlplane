import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type {
  DeploymentVersionCondition,
  TagCondition,
} from "@ctrlplane/validators/releases";
import type { InferSelectModel, SQL } from "drizzle-orm";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  ilike,
  lt,
  lte,
  not,
  notExists,
  or,
  relations,
  sql,
} from "drizzle-orm";
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
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  ColumnOperator,
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import {
  deploymentVersionCondition,
  DeploymentVersionConditionType,
  DeploymentVersionOperator,
  DeploymentVersionStatus,
} from "@ctrlplane/validators/releases";

import type { Tx } from "../common.js";
import { deployment } from "./deployment.js";

export const deploymentVersionChannel = pgTable(
  "deployment_version_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    versionSelector: jsonb("deployment_version_selector")
      .$type<DeploymentVersionCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.name) }),
);

export type DeploymentVersionChannel = InferSelectModel<
  typeof deploymentVersionChannel
>;
export const createDeploymentVersionChannel = createInsertSchema(
  deploymentVersionChannel,
  { versionSelector: deploymentVersionCondition },
).omit({ id: true });
export const updateDeploymentVersionChannel =
  createDeploymentVersionChannel.partial();

export const versionDependency = pgTable(
  "deployment_version_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("deployment_version_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    versionSelector: jsonb("deployment_version_selector")
      .$type<DeploymentVersionCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ unq: uniqueIndex().on(t.versionId, t.deploymentId) }),
);

export type VersionDependency = InferSelectModel<typeof versionDependency>;

const createVersionDependency = createInsertSchema(versionDependency, {
  versionSelector: deploymentVersionCondition,
}).omit({ id: true });

export const versionStatus = pgEnum("deployment_version_status", [
  "building",
  "ready",
  "failed",
  "rejected",
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
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    status: versionStatus("status").notNull().default("ready"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex().on(t.deploymentId, t.tag),
    createdAtIdx: index("deployment_version_created_at_idx").on(t.createdAt),
  }),
);

export type DeploymentVersion = InferSelectModel<typeof deploymentVersion>;

export const createDeploymentVersion = createInsertSchema(deploymentVersion, {
  tag: z.string().min(1),
  name: z.string().optional(),
  config: z.record(z.any()),
  jobAgentConfig: z.record(z.any()),
  status: z.nativeEnum(DeploymentVersionStatus),
  createdAt: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
})
  .omit({ id: true })
  .extend({
    versionDependencies: z
      .array(createVersionDependency.omit({ versionId: true }))
      .default([]),
  });

export const updateDeploymentVersion = createDeploymentVersion.partial();
export type UpdateDeploymentVersion = z.infer<typeof updateDeploymentVersion>;
export const deploymentVersionMetadata = pgTable(
  "deployment_version_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    versionId: uuid("deployment_version_id")
      .references(() => deploymentVersion.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.key, t.versionId),
    versionIdIdx: index("deployment_version_metadata_version_id_idx").on(
      t.versionId,
    ),
  }),
);

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(deploymentVersionMetadata)
        .where(
          and(
            eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
            eq(deploymentVersionMetadata.key, cond.key),
            ilike(deploymentVersionMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  return exists(
    tx
      .select({ value: sql<number>`1` })
      .from(deploymentVersionMetadata)
      .where(
        and(
          eq(deploymentVersionMetadata.versionId, deploymentVersion.id),
          eq(deploymentVersionMetadata.key, cond.key),
          eq(deploymentVersionMetadata.value, cond.value),
        ),
      )
      .limit(1),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(deploymentVersion.createdAt, date);
  if (cond.operator === DateOperator.After)
    return gt(deploymentVersion.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(deploymentVersion.createdAt, date);
  return gte(deploymentVersion.createdAt, date);
};

const buildVersionCondition = (cond: VersionCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(deploymentVersion.tag, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(deploymentVersion.tag, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(deploymentVersion.tag, `%${cond.value}`);
  return ilike(deploymentVersion.tag, `%${cond.value}%`);
};

const buildTagCondition = (cond: TagCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(deploymentVersion.tag, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(deploymentVersion.tag, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(deploymentVersion.tag, `%${cond.value}`);
  return ilike(deploymentVersion.tag, `%${cond.value}%`);
};

const buildCondition = (tx: Tx, cond: DeploymentVersionCondition): SQL => {
  if (cond.type === DeploymentVersionConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === DeploymentVersionConditionType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === DeploymentVersionConditionType.Version)
    return buildVersionCondition(cond);
  if (cond.type === DeploymentVersionConditionType.Tag)
    return buildTagCondition(cond);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === DeploymentVersionOperator.And
      ? and(...subCon)!
      : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function deploymentVersionMatchesCondition(
  tx: Tx,
  condition?: DeploymentVersionCondition | null,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(tx, condition);
}

export const deploymentVersionRelations = relations(
  deploymentVersion,
  ({ one, many }) => ({
    deployment: one(deployment, {
      fields: [deploymentVersion.deploymentId],
      references: [deployment.id],
    }),
    metadata: many(deploymentVersionMetadata),
    dependencies: many(versionDependency),
  }),
);

export const deploymentVersionChannelRelations = relations(
  deploymentVersionChannel,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [deploymentVersionChannel.deploymentId],
      references: [deployment.id],
    }),
  }),
);

export const versionDependencyRelations = relations(
  versionDependency,
  ({ one }) => ({
    version: one(deploymentVersion, {
      fields: [versionDependency.versionId],
      references: [deploymentVersion.id],
    }),
    deployment: one(deployment, {
      fields: [versionDependency.deploymentId],
      references: [deployment.id],
    }),
  }),
);

export const deploymentVersionMetadataRelations = relations(
  deploymentVersionMetadata,
  ({ one }) => ({
    version: one(deploymentVersion, {
      fields: [deploymentVersionMetadata.versionId],
      references: [deploymentVersion.id],
    }),
  }),
);
