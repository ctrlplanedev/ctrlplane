import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, selector } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { mergePolicies } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";
import {
  getAnyReleaseTargetForDeploymentAndEnvironment,
  getApplicablePoliciesWithoutResourceScope,
  getVersionWithMetadata,
} from "./utils";

export const versionSelector = protectedProcedure
  .input(
    z.object({
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
  .query(async ({ ctx, input }) => {
    const { versionId, environmentId } = input;
    const version = await getVersionWithMetadata(ctx.db, versionId);
    const { deploymentId } = version;

    const environment = await ctx.db.query.environment.findFirst({
      where: eq(SCHEMA.environment.id, environmentId),
      with: { system: true },
    });
    if (environment == null)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Environment not found: ${environmentId}`,
      });

    const { system } = environment;
    const { workspaceId } = system;

    const releaseTarget = await getAnyReleaseTargetForDeploymentAndEnvironment(
      ctx.db,
      deploymentId,
      environmentId,
      workspaceId,
    );
    const policies = await getApplicablePoliciesWithoutResourceScope(
      ctx.db,
      releaseTarget.id,
    );
    const mergedPolicy = mergePolicies(policies);
    const versionSelector =
      mergedPolicy?.deploymentVersionSelector?.deploymentVersionSelector;
    if (versionSelector == null) return true;

    const matchedVersion = await ctx.db.query.deploymentVersion.findFirst({
      where: and(
        eq(SCHEMA.deploymentVersion.id, versionId),
        selector().query().deploymentVersions().where(versionSelector).sql(),
      ),
    });

    return matchedVersion != null;
  });
