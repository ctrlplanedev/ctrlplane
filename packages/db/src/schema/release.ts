import type {
  CreatedAtCondition,
  MetadataCondition,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
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
  releaseCondition,
  ReleaseFilterType,
  ReleaseOperator,
  ReleaseStatus,
} from "@ctrlplane/validators/releases";

import type { Tx } from "../common.js";
import { user } from "./auth.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { job } from "./job.js";
import { resource } from "./resource.js";

export const releaseChannel = pgTable(
  "deployment_version_channel",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    releaseFilter: jsonb("deployment_version_selector")
      .$type<ReleaseCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.name) }),
);

export type ReleaseChannel = InferSelectModel<typeof releaseChannel>;
export const createReleaseChannel = createInsertSchema(releaseChannel, {
  releaseFilter: releaseCondition,
}).omit({ id: true });
export const updateReleaseChannel = createReleaseChannel.partial();

export const releaseDependency = pgTable(
  "deployment_version_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("deployment_version_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    releaseFilter: jsonb("deployment_version_selector")
      .$type<ReleaseCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ unq: uniqueIndex().on(t.releaseId, t.deploymentId) }),
);

export type ReleaseDependency = InferSelectModel<typeof releaseDependency>;

const createReleaseDependency = createInsertSchema(releaseDependency, {
  releaseFilter: releaseCondition,
}).omit({ id: true });

export const releaseStatus = pgEnum("deployment_version_status", [
  "building",
  "ready",
  "failed",
]);

export const release = pgTable(
  "deployment_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    version: text("tag").notNull(),
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
    status: releaseStatus("status").notNull().default("ready"),
    message: text("message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    unq: uniqueIndex().on(t.deploymentId, t.version),
    createdAtIdx: index("deployment_version_created_at_idx").on(t.createdAt),
  }),
);

export type Release = InferSelectModel<typeof release>;

export const createRelease = createInsertSchema(release, {
  version: z.string().min(1),
  name: z.string().optional(),
  config: z.record(z.any()),
  jobAgentConfig: z.record(z.any()),
  status: z.nativeEnum(ReleaseStatus),
  createdAt: z
    .string()
    .transform((s) => new Date(s))
    .optional(),
})
  .omit({ id: true })
  .extend({
    releaseDependencies: z
      .array(createReleaseDependency.omit({ releaseId: true }))
      .default([]),
  });

export const updateRelease = createRelease.partial();
export type UpdateRelease = z.infer<typeof updateRelease>;
export const releaseMetadata = pgTable(
  "deployment_version_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    releaseId: uuid("deployment_version_id")
      .references(() => release.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.releaseId) }),
);

export const releaseJobTriggerType = pgEnum("release_job_trigger_type", [
  "new_release", //  release was created
  "release_updated", // release was updated
  "new_resource", // new resource was added to an env
  "resource_changed",
  "api", // calling API
  "redeploy", // redeploying
  "force_deploy", // force deploying a release
  "new_environment",
  "variable_changed",
  "retry", // retrying a failed job
]);

export const releaseJobTrigger = pgTable(
  "release_job_trigger",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => job.id)
      .unique(),

    type: releaseJobTriggerType("type").notNull(),
    causedById: uuid("caused_by_id").references(() => user.id),

    releaseId: uuid("deployment_version_id")
      .references(() => release.id, { onDelete: "cascade" })
      .notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    environmentId: uuid("environment_id")
      .references(() => environment.id, { onDelete: "cascade" })
      .notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => ({}),
);

export type ReleaseJobTrigger = InferSelectModel<typeof releaseJobTrigger>;
export type ReleaseJobTriggerType = ReleaseJobTrigger["type"];
export type ReleaseJobTriggerInsert = InferInsertModel<
  typeof releaseJobTrigger
>;
export const releaseJobTriggerRelations = relations(
  releaseJobTrigger,
  ({ one }) => ({
    job: one(job, {
      fields: [releaseJobTrigger.jobId],
      references: [job.id],
    }),
    resource: one(resource, {
      fields: [releaseJobTrigger.resourceId],
      references: [resource.id],
    }),
  }),
);
const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select({ value: sql<number>`1` })
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Regex)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            sql`${releaseMetadata.value} ~ ${cond.value}`,
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            ilike(releaseMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            ilike(releaseMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            ilike(releaseMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  return exists(
    tx
      .select({ value: sql<number>`1` })
      .from(releaseMetadata)
      .where(
        and(
          eq(releaseMetadata.releaseId, release.id),
          eq(releaseMetadata.key, cond.key),
          eq(releaseMetadata.value, cond.value),
        ),
      )
      .limit(1),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before) return lt(release.createdAt, date);
  if (cond.operator === DateOperator.After) return gt(release.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(release.createdAt, date);
  return gte(release.createdAt, date);
};

const buildVersionCondition = (cond: VersionCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(release.version, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(release.version, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(release.version, `%${cond.value}`);
  if (cond.operator === ColumnOperator.Contains)
    return ilike(release.version, `%${cond.value}%`);
  return sql`${release.version} ~ ${cond.value}`;
};

const buildCondition = (tx: Tx, cond: ReleaseCondition): SQL => {
  if (cond.type === ReleaseFilterType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ReleaseFilterType.CreatedAt)
    return buildCreatedAtCondition(cond);
  if (cond.type === ReleaseFilterType.Version)
    return buildVersionCondition(cond);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ReleaseOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function releaseMatchesCondition(
  tx: Tx,
  condition?: ReleaseCondition | null,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(tx, condition);
}
