import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import {
  createDashboardWidget,
  dashboard,
  dashboardWidget,
  updateDashboardWidget,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const dashboardRouter = createTRPCRouter({
  widget: createTRPCRouter({
    create: protectedProcedure
      .input(createDashboardWidget)
      .mutation(({ ctx, input }) =>
        ctx.db.insert(dashboardWidget).values(input).onConflictDoNothing(),
      ),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          data: updateDashboardWidget,
        }),
      )
      .mutation(({ ctx, input: { id, data } }) =>
        ctx.db
          .update(dashboardWidget)
          .set(data)
          .where(eq(dashboardWidget.id, id)),
      ),

    delete: protectedProcedure
      .input(z.string().uuid())
      .mutation(({ ctx, input }) =>
        ctx.db.delete(dashboardWidget).where(eq(dashboardWidget.id, input)),
      ),
  }),

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
});
