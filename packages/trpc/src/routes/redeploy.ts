import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { enqueueForceDeploy } from "@ctrlplane/db/reconcilers";

import { protectedProcedure, router } from "../trpc.js";

type ReleaseTarget = {
  deploymentId: string;
  environmentId: string;
  resourceId: string;
};

const redeployReleaseTarget = (
  db: Tx,
  workspaceId: string,
  releaseTarget: ReleaseTarget,
) =>
  enqueueForceDeploy(db, {
    workspaceId,
    deploymentId: releaseTarget.deploymentId,
    environmentId: releaseTarget.environmentId,
    resourceId: releaseTarget.resourceId,
  });

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
    .mutation(({ input: { workspaceId, releaseTarget }, ctx }) =>
      redeployReleaseTarget(ctx.db, workspaceId, releaseTarget),
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
    .mutation(({ input: { workspaceId, releaseTargets }, ctx }) =>
      releaseTargets.map((releaseTarget) =>
        redeployReleaseTarget(ctx.db, workspaceId, releaseTarget),
      ),
    ),
});
