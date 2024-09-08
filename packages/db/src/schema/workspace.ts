import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const updateWorkspace = createWorkspace.partial();

export type Workspace = InferSelectModel<typeof workspace>;
