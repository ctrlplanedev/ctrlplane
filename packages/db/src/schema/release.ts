import type {
  CreatedAtCondition,
  MetadataCondition,
  ReleaseCondition,
  VersionCondition,
} from "@ctrlplane/validators/releases";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import {
  and,
  eq,
  exists,
  gt,
  gte,
  like,
  lt,
  lte,
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import {
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
  releaseCondition,
  ReleaseFilterType,
  ReleaseOperator,
} from "@ctrlplane/validators/releases";

import type { Tx } from "../common.js";
import { user } from "./auth.js";
import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { job } from "./job.js";
import { target } from "./target.js";

export const releaseDependency = pgTable(
  "release_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => release.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    releaseFilter: jsonb("release_filter").notNull().$type<ReleaseCondition>(),
  },
  (t) => ({ unq: uniqueIndex().on(t.releaseId, t.deploymentId) }),
);

export type ReleaseDependency = InferSelectModel<typeof releaseDependency>;

const createReleaseDependency = createInsertSchema(releaseDependency, {
  releaseFilter: releaseCondition,
}).omit({
  id: true,
});

export const release = pgTable(
  "release",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ unq: uniqueIndex().on(t.deploymentId, t.version) }),
);

export type Release = InferSelectModel<typeof release>;

export const createRelease = createInsertSchema(release, {
  version: z.string().min(1),
  name: z.string().min(1),
  config: z.record(z.any()),
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

export const releaseMetadata = pgTable(
  "release_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    releaseId: uuid("release_id")
      .references(() => release.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.releaseId) }),
);

export const releaseJobTriggerType = pgEnum("release_job_trigger_type", [
  "new_release", //  release was created
  "new_target", // new target was added to an env
  "target_changed",
  "api", // calling API
  "redeploy", // redeploying
  "force_deploy", // force deploying a release
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

    releaseId: uuid("release_id")
      .references(() => release.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
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

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === "null")
    return notExists(
      tx
        .select()
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
          ),
        ),
    );

  if (cond.operator === "regex")
    return exists(
      tx
        .select()
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            sql`${releaseMetadata.value} ~ ${cond.value}`,
          ),
        ),
    );

  if (cond.operator === "like")
    return exists(
      tx
        .select()
        .from(releaseMetadata)
        .where(
          and(
            eq(releaseMetadata.releaseId, release.id),
            eq(releaseMetadata.key, cond.key),
            like(releaseMetadata.value, cond.value),
          ),
        ),
    );

  return exists(
    tx
      .select()
      .from(releaseMetadata)
      .where(
        and(
          eq(releaseMetadata.releaseId, release.id),
          eq(releaseMetadata.key, cond.key),
          eq(releaseMetadata.value, cond.value),
        ),
      ),
  );
};

const buildCreatedAtCondition = (cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === ReleaseOperator.Before)
    return lt(release.createdAt, date);
  if (cond.operator === ReleaseOperator.After)
    return gt(release.createdAt, date);
  if (cond.operator === ReleaseOperator.BeforeOrOn)
    return lte(release.createdAt, date);
  return gte(release.createdAt, date);
};

const buildVersionCondition = (cond: VersionCondition): SQL => {
  if (cond.operator === ReleaseOperator.Equals)
    return eq(release.version, cond.value);
  if (cond.operator === ReleaseOperator.Like)
    return like(release.version, cond.value);
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
  condition?: ReleaseCondition,
): SQL<unknown> | undefined {
  return condition == null || Object.keys(condition).length === 0
    ? undefined
    : buildCondition(tx, condition);
}
