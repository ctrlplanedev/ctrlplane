import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { workspace } from "./workspace.js";

export const system = pgTable(
  "system",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex().on(t.workspaceId, t.slug)],
);

export type System = InferSelectModel<typeof system>;

export const systemRelations = relations(system, ({ one, many }) => ({
  environments: many(environment),
  deployments: many(deployment),
  workspace: one(workspace, {
    fields: [system.workspaceId],
    references: [workspace.id],
  }),
}));
