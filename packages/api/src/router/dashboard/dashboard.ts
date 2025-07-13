import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createDashboard,
  dashboard,
  dashboardWidget,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { dashboardWidgetRouter } from "./dashboard-widgets";

export const dashboardRouter = createTRPCRouter({
  widget: dashboardWidgetRouter,

  get: protectedProcedure.input(z.string().uuid()).query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(dashboard)
      .leftJoin(dashboardWidget, eq(dashboard.id, dashboardWidget.dashboardId))
      .where(eq(dashboard.id, input))
      .then((rows) =>
        rows.length === 0
          ? null
          : {
              ...rows[0]!.dashboard,
              widgets: rows.map((r) => r.dashboard_widget).filter(isPresent),
            },
      ),
  ),

  byWorkspaceId: protectedProcedure
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.select().from(dashboard).where(eq(dashboard.workspaceId, input)),
    ),

  create: protectedProcedure
    .input(createDashboard)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(dashboard).values(input).returning().then(takeFirst),
    ),
});
