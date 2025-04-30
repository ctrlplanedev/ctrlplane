import { z } from "zod";

import { and, eq, selector } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { mergePolicies } from "@ctrlplane/rule-engine";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";
import { getVersionWithMetadata } from "./utils";

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

    const policies = await getApplicablePolicies()
      .environmentAndDeployment({ environmentId, deploymentId })
      .withoutResourceScope();
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
