import {
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const workflow = pgTable("workflow", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inputs: jsonb("inputs").notNull().default("[]"),
  jobs: jsonb("jobs").notNull().default("[]"),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
});

export const workflowJobTemplate = pgTable("workflow_job_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflow.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ref: text("ref").notNull(),
  config: jsonb("config").notNull().default("{}"),
  ifCondition: text("if_condition"),
  matrix: jsonb("matrix"),
});

export const workflowRun = pgTable("workflow_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => workflow.id, { onDelete: "cascade" }),
  inputs: jsonb("inputs").notNull().default("{}"),
});

export const workflowJob = pgTable("workflow_job", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowRunId: uuid("workflow_run_id")
    .notNull()
    .references(() => workflowRun.id, { onDelete: "cascade" }),
  ref: text("ref").notNull(),
  config: jsonb("config").notNull().default("{}"),
  index: integer("index").notNull().default(0),
});
