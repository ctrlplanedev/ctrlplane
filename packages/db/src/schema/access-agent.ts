import { pgTable } from "drizzle-orm/pg-core";

export const accessAgent = pgTable("access_agent", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
});
