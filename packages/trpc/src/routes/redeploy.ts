import { z } from "zod";

import { eventDispatcher } from "@ctrlplane/events";

import { protectedProcedure, router } from "../trpc.js";

export const redeployRouter = router({
  releaseTarget: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), releaseTargetId: z.uuid() }))
    .mutation(({ input: { workspaceId, releaseTargetId } }) =>
      eventDispatcher.dispatchRedeploy(workspaceId, releaseTargetId),
    ),
});
