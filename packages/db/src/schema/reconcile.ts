import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
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
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
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
    index("reconcile_work_scope_unclaimed_idx")
      .on(t.kind, t.priority, t.eventTs, t.id)
      .where(sql`${t.claimedUntil} is null`),
    index("reconcile_work_scope_expired_claims_idx")
      .on(t.claimedUntil)
      .where(sql`${t.claimedUntil} is not null`),
  ],
);

export type ReconcileWorkScope = InferSelectModel<typeof reconcileWorkScope>;
export type CreateReconcileWorkScope = InferInsertModel<
  typeof reconcileWorkScope
>;
