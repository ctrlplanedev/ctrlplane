import { pgTable, uuid } from "drizzle-orm/pg-core";

import { target } from "./target.js";

export const targetSession = pgTable("target_session", {
  id: uuid("id").primaryKey(),
  targetId: uuid("target_id")
    .references(() => target.id, { onDelete: "cascade" })
    .notNull(),
});
