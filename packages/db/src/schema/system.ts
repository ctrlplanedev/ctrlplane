import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deployment } from "./deployment.js";
import { environment } from "./environment.js";
import { workspace } from "./workspace.js";

export const systemSchema = z.object({
  name: z
    .string()
    .min(3, { message: "System name must be at least 3 characters long." })
    .max(100, { message: "System Name must be at most 100 characters long." }),
  slug: z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long." })
    .max(255, { message: "Slug must be at most 255 characters long." }),
  description: z
    .string()
    .max(255, { message: "Description must be at most 255 characters long." })
    .optional()
    .refine((val) => !val || val.length >= 3, {
      message: "Description must be at least 3 characters long if provided.",
    }),
});

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
  (t) => ({ uniq: uniqueIndex().on(t.workspaceId, t.slug) }),
);

export const createSystem = createInsertSchema(system, systemSchema.shape).omit(
  { id: true },
);

export const updateSystem = createSystem.partial();

export type System = InferSelectModel<typeof system>;

export const systemRelations = relations(system, ({ one, many }) => ({
  environments: many(environment),
  deployments: many(deployment),
  workspace: one(workspace, {
    fields: [system.workspaceId],
    references: [workspace.id],
  }),
}));
