import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { user } from "./auth.js";
import { workspace } from "./workspace.js";

export const team = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("text").notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
});

export const createTeam = createInsertSchema(team).omit({ id: true });
export const updateTeam = createTeam.partial();

export const teamMember = pgTable(
  "team_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({ unq: uniqueIndex().on(t.teamId, t.userId) }),
);

export const createTeamMember = createInsertSchema(teamMember).omit({
  id: true,
});
