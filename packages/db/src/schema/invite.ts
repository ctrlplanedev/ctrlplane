import { pgTable, uuid } from "drizzle-orm/pg-core";

import { workspaceMember } from "./workspace.js";

export const workspaceInviteLink = pgTable("workspace_invite_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceMemberId: uuid("workspace_member_id")
    .notNull()
    .references(() => workspaceMember.id, { onDelete: "cascade" }),
  token: uuid("token").notNull().unique().defaultRandom(),
});
