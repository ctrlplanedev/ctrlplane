import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userApprovalRecord = pgTable(
  "user_approval_record",
  {
    versionId: uuid("version_id").notNull(),
    userId: uuid("user_id").notNull(),
    environmentId: uuid("environment_id").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.userId, t.environmentId] })],
);
