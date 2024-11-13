import { pgTable, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { resource } from "./target.js";

export const resourceSession = pgTable("resource_session", {
  id: uuid("id").primaryKey(),
  resourceId: uuid("resource_id")
    .references(() => resource.id)
    .notNull(),
  createdBy: uuid("created_by_id")
    .references(() => user.id)
    .notNull(),
});
