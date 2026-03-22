import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { job } from "./job.js";
import { workspace } from "./workspace.js";

export type WorkflowJobAgent = {
  id: string;
  name: string;
  ref: string;
  config: Record<string, any>;
  selector: string;
};

export const workflow = pgTable("workflow", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inputs: jsonb("inputs").notNull().default("[]"),
  jobAgents: jsonb("job_agents")
    .default("[]")
    .$type<Array<WorkflowJobAgent>>()
    .notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
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
  jobId: uuid("job_id")
    .notNull()
    .references(() => job.id, { onDelete: "cascade" }),
});
