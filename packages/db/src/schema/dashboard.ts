import type { InferSelectModel } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { workspace } from "./workspace";

export const dashboard = pgTable("dashboard", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const dashboardWidget = pgTable("dashboard_widget", {
  id: uuid("id").primaryKey().defaultRandom(),

  dashboardId: uuid("dashboard_id")
    .notNull()
    .references(() => dashboard.id, { onDelete: "cascade" })
    .notNull(),

  widget: text("widget").notNull(),
  config: jsonb("config").notNull().$type<Record<string, any>>().default({}),

  x: integer("x").notNull(),
  y: integer("y").notNull(),
  width: integer("w").notNull(),
  height: integer("h").notNull(),
});

export type Dashboard = InferSelectModel<typeof dashboard>;

const dashboardWidgetInsert = createInsertSchema(dashboardWidget, {
  config: z.record(z.any()),
}).omit({ id: true });

export const createDashboardWidget = dashboardWidgetInsert;
export const updateDashboardWidget = dashboardWidgetInsert.partial();
export type DashboardWidget = InferSelectModel<typeof dashboardWidget>;
