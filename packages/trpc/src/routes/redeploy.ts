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
});
