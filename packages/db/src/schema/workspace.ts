import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  googleServiceAccountEmail: text("google_service_account_email"),
});

export const workspaceSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Workspace name must be at least 3 characters long." })
    .max(30, { message: "Workspace Name must be at most 30 characters long." }),
  slug: z
    .string()
    .min(3, { message: "URL must be at least 3 characters long." })
    .max(50, { message: "URL must be at most 50 characters long." })
    .refine((slug) => slug === slug.toLowerCase(), {
      message: "Slug must be lowercase",
    })
    .refine((slug) => !slug.includes(" "), {
      message: "Slug cannot contain spaces",
    }),
});

export const createWorkspace = createInsertSchema(
  workspace,
  workspaceSchema.shape,
).omit({ id: true });

export const updateWorkspace = createWorkspace.partial();

export type Workspace = InferSelectModel<typeof workspace>;
