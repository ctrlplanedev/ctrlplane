import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { workspace } from "./workspace";

export const system = pgTable(
  "system",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
  },
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.slug) }),
);

export const createSystem = createInsertSchema(system).omit({ id: true });

export const updateSystem = createInsertSchema(system)
  .partial()
  .omit({ id: true });

export type System = InferSelectModel<typeof system>;
