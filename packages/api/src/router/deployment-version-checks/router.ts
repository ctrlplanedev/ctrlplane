import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { approvalRouter } from "./approvals";
import { denyWindowRouter } from "./deny-window";
import { versionSelector } from "./version-selector";

export const deploymentVersionChecksRouter = createTRPCRouter({
  environmentsToCheck: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const deployment = await ctx.db.query.deployment.findFirst({
          where: eq(SCHEMA.deployment.id, input),
        });
        if (deployment == null) return false;
        return canUser
          .perform(Permission.EnvironmentList)
          .on({ type: "system", id: deployment.systemId });
      },
    })
    .query(async ({ ctx, input: deploymentId }) => {
      const rows = await ctx.db
        .selectDistinctOn([SCHEMA.environment.id])
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
        )
        .where(eq(SCHEMA.releaseTarget.deploymentId, deploymentId))
        .orderBy(SCHEMA.environment.id);
      return rows.map((r) => r.environment);
    }),
  approval: approvalRouter,
  denyWindow: denyWindowRouter,
  versionSelector,
});
