import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { VersionReleaseManager } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const approvalRouter = createTRPCRouter({
  byVersionAndEnvironment: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        versionId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.versionId,
        }),
    })
    .query(
      async ({ ctx, input: { versionId, environmentId, workspaceId } }) => {
        const v = await ctx.db.query.deploymentVersion.findFirst({
          where: eq(SCHEMA.deploymentVersion.id, versionId),
          with: { metadata: true },
        });

        if (v == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Deployment version not found: ${versionId}`,
          });
        }

        const metadata = Object.fromEntries(
          v.metadata.map((m) => [m.key, m.value]),
        );
        const version = { ...v, metadata };

        const { deploymentId } = version;
        // since the resource does not affect the approval rules, we can just use any release target
        // for the given deployment and environment
        const rt = await ctx.db.query.releaseTarget.findFirst({
          where: and(
            eq(SCHEMA.releaseTarget.deploymentId, deploymentId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        });
        if (rt == null) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Release target not found: ${deploymentId} ${environmentId}`,
          });
        }

        const releaseTarget = { ...rt, workspaceId };
        const manager = new VersionReleaseManager(ctx.db, releaseTarget, [
          version,
        ]);

        const result = await manager.evaluateApprovalRules();
        return result;
      },
    ),
});

export const deploymentVersionChecksRouter = createTRPCRouter({
  approval: approvalRouter,
});
