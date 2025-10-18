import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../trpc";
import { getWorkspaceEngineClient } from "../workspace-engine-client";

const getWorkspaceId = async (tx: Tx, versionId: string) =>
  tx
    .select()
    .from(SCHEMA.deploymentVersion)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
    )
    .innerJoin(SCHEMA.system, eq(SCHEMA.deployment.systemId, SCHEMA.system.id))
    .where(eq(SCHEMA.deploymentVersion.id, versionId))
    .then(takeFirst)
    .then(({ system }) => system.workspaceId);

export const deploymentVersionJobsList = protectedProcedure
  .input(
    z.object({
      versionId: z.string().uuid(),
      search: z.string().default(""),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.DeploymentVersionGet).on({
        type: "deploymentVersion",
        id: input.versionId,
      }),
  })
  .query(async ({ ctx, input: { versionId } }) => {
    console.log("getting deployment version jobs list");
    const workspaceId = await getWorkspaceId(ctx.db, versionId);
    const client = getWorkspaceEngineClient();
    const resp = await client.GET(
      "/v1/workspaces/{workspaceId}/deployment-versions/{versionId}/jobs-list",
      {
        params: {
          path: {
            workspaceId,
            versionId,
          },
        },
      },
    );

    if (resp.error?.error != null) throw new Error(resp.error.error);

    console.log(resp.data);

    for (const environment of resp.data ?? []) {
      for (const releaseTarget of environment.releaseTargets) {
        console.log(releaseTarget);
        for (const job of releaseTarget?.jobs ?? []) {
          console.log(job);
        }
      }
    }

    return resp.data;
  });
