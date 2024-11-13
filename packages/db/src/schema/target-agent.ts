import { pgTable, uuid } from "drizzle-orm/pg-core";

import { resource } from "./target.js";

export const resourceSession = pgTable("resource_session", {
  id: uuid("id").primaryKey(),
  resourceId: uuid("resource_id")
    .references(() => resource.id, { onDelete: "cascade" })
    .notNull(),
});
