import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const deploymentLifecycleHookRouter = createTRPCRouter({
  list: createTRPCRouter({
    byDeploymentId: protectedProcedure
      .input(z.string().uuid())
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.DeploymentGet)
            .on({ type: "deployment", id: input }),
      })
      .query(async ({ ctx, input }) =>
        ctx.db
          .select()
          .from(SCHEMA.deploymentLifecycleHook)
          .innerJoin(
            SCHEMA.runbook,
            eq(SCHEMA.deploymentLifecycleHook.runbookId, SCHEMA.runbook.id),
          )
          .where(eq(SCHEMA.deploymentLifecycleHook.deploymentId, input))
          .then((rows) =>
            rows.map((r) => ({
              ...r.deployment_lifecycle_hook,
              runbook: r.runbook,
            })),
          ),
      ),
  }),

  create: protectedProcedure
    .input(SCHEMA.createDeploymentLifecycleHook)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentUpdate).on({
          type: "deployment",
          id: input.deploymentId,
        }),
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(SCHEMA.deploymentLifecycleHook).values(input),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const hook = await ctx.db
          .select()
          .from(SCHEMA.deploymentLifecycleHook)
          .where(eq(SCHEMA.deploymentLifecycleHook.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: hook.deploymentId });
      },
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(SCHEMA.deploymentLifecycleHook)
        .where(eq(SCHEMA.deploymentLifecycleHook.id, input)),
    ),
});
