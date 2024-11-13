import { pgTable, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth.js";
import { target } from "./target.js";

export const targetSession = pgTable("target_session", {
  id: uuid("id").primaryKey(),
  targetId: uuid("target_id")
    .references(() => target.id)
    .notNull(),
  createdBy: uuid("created_by_id")
    .references(() => user.id)
    .notNull(),
});
