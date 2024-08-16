import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "./auth";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  googleServiceAccountEmail: text("google_service_account_email"),
});

export const createWorkspace = createInsertSchema(workspace, {
  name: z.string().max(50).min(3),
  slug: z
    .string()
    .min(3)
    .max(50)
    .refine((slug) => slug === slug.toLowerCase(), {
      message: "Slug must be lowercase",
    })
    .refine((slug) => !slug.includes(" "), {
      message: "Slug cannot contain spaces",
    }),
}).omit({ id: true });

export type Workspace = InferSelectModel<typeof workspace>;

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => ({
    unq: uniqueIndex().on(t.workspaceId, t.userId),
  }),
);

export type WorkspaceMember = InferSelectModel<typeof workspaceMember>;
