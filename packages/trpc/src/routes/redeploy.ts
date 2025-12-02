import { z } from "zod";

import { eventDispatcher } from "@ctrlplane/events";

import { protectedProcedure, router } from "../trpc.js";

export const redeployRouter = router({
  releaseTarget: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        releaseTarget: z.object({
          deploymentId: z.uuid(),
          environmentId: z.uuid(),
          resourceId: z.uuid(),
        }),
      }),
    )
    .mutation(({ input: { workspaceId, releaseTarget } }) =>
      eventDispatcher.dispatchRedeploy(workspaceId, releaseTarget),
    ),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargets: z.array(
          z.object({
            deploymentId: z.string(),
            environmentId: z.string(),
            resourceId: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input: { workspaceId, releaseTargets } }) => {
      for (const releaseTarget of releaseTargets)
        await eventDispatcher.dispatchRedeploy(workspaceId, releaseTarget);
    }),
});
