import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { role } from "./rbac.js";
import { workspaceMember } from "./workspace.js";

export const workspaceInviteLink = pgTable("workspace_invite_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id")
    .references(() => role.id, { onDelete: "cascade" })
    .notNull(),
  workspaceMemberId: uuid("workspace_member_id")
    .notNull()
    .references(() => workspaceMember.id, { onDelete: "cascade" }),
  token: uuid("token").notNull().unique().defaultRandom(),
  expiresAt: timestamp("expires_at").notNull(),
});
