import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const deploymentTraceSpan = pgTable(
  "deployment_trace_span",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // OTel identifiers
    traceId: text("trace_id").notNull(),
    spanId: text("span_id").notNull(),
    parentSpanId: text("parent_span_id"),

    // Span data
    name: text("name").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),

    // Deployment context
    workspaceId: uuid("workspace_id")
      .references(() => workspace.id, { onDelete: "cascade" })
      .notNull(),
    releaseTargetKey: text("release_target_key"),
    releaseId: text("release_id"), // Stored as text, no FK
    jobId: text("job_id"), // Stored as text, no FK
    parentTraceId: text("parent_trace_id"), // Links external traces to parent

    // Trace attributes
    phase: text("phase"),
    nodeType: text("node_type"),
    status: text("status"),
    depth: integer("depth"),
    sequence: integer("sequence"),

    // Additional data
    attributes: jsonb("attributes").$type<Record<string, any>>(),
    events: jsonb("events").$type<
      Array<{
        name: string;
        timestamp: string;
        attributes: Record<string, any>;
      }>
    >(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Unique constraint on trace_id + span_id
    uniq: uniqueIndex("deployment_trace_span_trace_span_idx").on(
      t.traceId,
      t.spanId,
    ),

    // Primary indexes for querying
    traceIdIdx: index("deployment_trace_span_trace_id_idx").on(t.traceId),
    parentSpanIdIdx: index("deployment_trace_span_parent_span_id_idx").on(
      t.parentSpanId,
    ),
    workspaceIdIdx: index("deployment_trace_span_workspace_id_idx").on(
      t.workspaceId,
    ),

    // Context indexes for filtering
    releaseTargetKeyIdx: index(
      "deployment_trace_span_release_target_key_idx",
    ).on(t.releaseTargetKey),
    releaseIdIdx: index("deployment_trace_span_release_id_idx").on(t.releaseId),
    jobIdIdx: index("deployment_trace_span_job_id_idx").on(t.jobId),
    parentTraceIdIdx: index("deployment_trace_span_parent_trace_id_idx").on(
      t.parentTraceId,
    ),

    // Temporal and attribute indexes
    createdAtIdx: index("deployment_trace_span_created_at_idx").on(t.createdAt),
    phaseIdx: index("deployment_trace_span_phase_idx").on(t.phase),
    nodeTypeIdx: index("deployment_trace_span_node_type_idx").on(t.nodeType),
    statusIdx: index("deployment_trace_span_status_idx").on(t.status),
  }),
);

export type DeploymentTraceSpan = InferSelectModel<typeof deploymentTraceSpan>;
export type InsertDeploymentTraceSpan = InferInsertModel<
  typeof deploymentTraceSpan
>;

export const deploymentTraceSpanRelations = relations(
  deploymentTraceSpan,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [deploymentTraceSpan.workspaceId],
      references: [workspace.id],
    }),
  }),
);
