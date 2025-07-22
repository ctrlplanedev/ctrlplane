import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createDashboardWidget,
  dashboardWidget,
  updateDashboardWidget,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { deploymentVersionDistribution } from "./widget-data/deployment-version-distribution";
import { releaseTargetModule } from "./widget-data/release-target-module";
import { systemResourceDeployments } from "./widget-data/system-resource";

export const dashboardWidgetRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createDashboardWidget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(dashboardWidget).values(input).returning().then(takeFirst),
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

  data: createTRPCRouter({
    deploymentVersionDistribution,
    releaseTargetModule,
    systemResourceDeployments,
  }),
});
