import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
import { jobAgent } from "./job-agent.js";
import { resource } from "./resource.js";

export const variableScopeEnum = pgEnum("variable_scope", [
  "resource",
  "deployment",
  "job_agent",
]);

export const variableValueKindEnum = pgEnum("variable_value_kind", [
  "literal",
  "ref",
  "secret_ref",
]);

export const variable = pgTable(
  "variable",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    scope: variableScopeEnum("scope").notNull(),

    resourceId: uuid("resource_id").references(() => resource.id, {
      onDelete: "cascade",
    }),

    deploymentId: uuid("deployment_id").references(() => deployment.id, {
      onDelete: "cascade",
    }),

    jobAgentId: uuid("job_agent_id").references(() => jobAgent.id, {
      onDelete: "cascade",
    }),

    key: text("key").notNull(),

    isSensitive: boolean("is_sensitive").notNull().default(false),
    description: text("description"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("variable_resource_key_uniq")
      .on(table.resourceId, table.key)
      .where(sql`${table.resourceId} is not null`),

    uniqueIndex("variable_deployment_key_uniq")
      .on(table.deploymentId, table.key)
      .where(sql`${table.deploymentId} is not null`),

    uniqueIndex("variable_job_agent_key_uniq")
      .on(table.jobAgentId, table.key)
      .where(sql`${table.jobAgentId} is not null`),

    index("variable_scope_idx").on(table.scope),

    check(
      "variable_scope_target_check",
      sql`
        (
          ${table.scope} = 'resource'
          and ${table.resourceId} is not null
          and ${table.deploymentId} is null
          and ${table.jobAgentId} is null
        )
        or
        (
          ${table.scope} = 'deployment'
          and ${table.deploymentId} is not null
          and ${table.resourceId} is null
          and ${table.jobAgentId} is null
        )
        or
        (
          ${table.scope} = 'job_agent'
          and ${table.jobAgentId} is not null
          and ${table.resourceId} is null
          and ${table.deploymentId} is null
        )
      `,
    ),
  ],
);

export const variableValue = pgTable(
  "variable_value",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    variableId: uuid("variable_id")
      .notNull()
      .references(() => variable.id, { onDelete: "cascade" }),

    resourceSelector: text("resource_selector"),

    priority: bigint("priority", { mode: "number" }).notNull().default(0),

    kind: variableValueKindEnum("kind").notNull(),

    literalValue: jsonb("literal_value"),

    refKey: text("ref_key"),
    refPath: text("ref_path").array(),

    secretProvider: text("secret_provider"),
    secretKey: text("secret_key"),
    secretPath: text("secret_path").array(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("variable_value_variable_priority_idx").on(
      table.variableId,
      table.priority,
      table.id,
    ),

    index("variable_value_kind_idx").on(table.kind),

    uniqueIndex("variable_value_resolution_uniq").on(
      table.variableId,
      sql`coalesce(${table.resourceSelector}, '')`,
      table.priority,
    ),

    check(
      "variable_value_kind_shape_check",
      sql`
        (
          ${table.kind} = 'literal'
          and ${table.literalValue} is not null
          and ${table.refKey} is null
          and ${table.refPath} is null
          and ${table.secretProvider} is null
          and ${table.secretKey} is null
          and ${table.secretPath} is null
        )
        or
        (
          ${table.kind} = 'ref'
          and ${table.literalValue} is null
          and ${table.refKey} is not null
          and ${table.secretProvider} is null
          and ${table.secretKey} is null
          and ${table.secretPath} is null
        )
        or
        (
          ${table.kind} = 'secret_ref'
          and ${table.literalValue} is null
          and ${table.refKey} is null
          and ${table.refPath} is null
          and ${table.secretProvider} is not null
          and ${table.secretKey} is not null
        )
      `,
    ),
  ],
);
