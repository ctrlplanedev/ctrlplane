import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { role } from "./rbac.js";
import { workspace } from "./workspace.js";

export const workspaceInviteToken = pgTable("workspace_invite_token", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id")
    .references(() => role.id, { onDelete: "cascade" })
    .notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
  token: uuid("token").notNull().unique().defaultRandom(),
  expiresAt: timestamp("expires_at").notNull(),
});
