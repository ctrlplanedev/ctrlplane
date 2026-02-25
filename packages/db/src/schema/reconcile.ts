import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const reconcileWorkScope = pgTable(
  "reconcile_work_scope",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    workspaceId: uuid("workspace_id").notNull(),
    kind: text("kind").notNull(),
    scopeType: text("scope_type").notNull().default(""),
    scopeId: text("scope_id").notNull().default(""),
    eventTs: timestamp("event_ts", { withTimezone: true })
      .notNull()
      .defaultNow(),
    priority: smallint("priority").notNull().default(100),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedBy: text("claimed_by"),
    claimedUntil: timestamp("claimed_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex().on(t.workspaceId, t.kind, t.scopeType, t.scopeId),
    index().on(t.kind, t.notBefore, t.priority, t.eventTs, t.claimedUntil),
  ],
);

export const reconcileWorkPayload = pgTable(
  "reconcile_work_payload",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedByDefaultAsIdentity(),
    scopeRef: bigint("scope_ref", { mode: "number" })
      .notNull()
      .references(() => reconcileWorkScope.id, { onDelete: "cascade" }),
    payloadType: text("payload_type").notNull().default(""),
    payloadKey: text("payload_key").notNull().default(""),
    payload: jsonb("payload")
      .notNull()
      .$type<Record<string, any>>()
      .default({}),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex().on(t.scopeRef, t.payloadType, t.payloadKey),
    index().on(t.scopeRef),
  ],
);

export const reconcileWorkScopeRelations = relations(
  reconcileWorkScope,
  ({ many }) => ({
    payloads: many(reconcileWorkPayload),
  }),
);

export const reconcileWorkPayloadRelations = relations(
  reconcileWorkPayload,
  ({ one }) => ({
    scope: one(reconcileWorkScope, {
      fields: [reconcileWorkPayload.scopeRef],
      references: [reconcileWorkScope.id],
    }),
  }),
);

export type ReconcileWorkScope = InferSelectModel<typeof reconcileWorkScope>;
export type CreateReconcileWorkScope = InferInsertModel<
  typeof reconcileWorkScope
>;
export type ReconcileWorkPayload = InferSelectModel<
  typeof reconcileWorkPayload
>;
export type CreateReconcileWorkPayload = InferInsertModel<
  typeof reconcileWorkPayload
>;
