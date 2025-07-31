import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { and, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  getRolloutInfoForReleaseTarget,
  mergePolicies,
} from "@ctrlplane/rule-engine";
import { getApplicablePoliciesWithoutResourceScope } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const getVersion = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, versionId))
    .then(takeFirst);

const getReleaseTargets = async (
  db: Tx,
  deploymentId: string,
  environmentId: string,
) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .where(
      and(
        eq(schema.releaseTarget.deploymentId, deploymentId),
        eq(schema.releaseTarget.environmentId, environmentId),
      ),
    )
    .then((rows) =>
      rows.map((row) => ({
        ...row.release_target,
        resource: row.resource,
        deployment: row.deployment,
        environment: row.environment,
      })),
    );

const getPolicy = async (
  db: Tx,
  environmentId: string,
  deploymentId: string,
) => {
  const policies = await getApplicablePoliciesWithoutResourceScope(
    db,
    environmentId,
    deploymentId,
  );

  return mergePolicies(policies);
};

const getEnvironment = async (db: Tx, environmentId: string) =>
  db
    .select()
    .from(schema.environment)
    .where(eq(schema.environment.id, environmentId))
    .then(takeFirst);

export const rolloutRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        versionId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.EnvironmentGet).on({
          type: "environment",
          id: input.environmentId,
        }),
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, versionId } = input;

      const version = await getVersion(ctx.db, versionId);
      const environment = await getEnvironment(ctx.db, environmentId);

      const releaseTargets = await getReleaseTargets(
        ctx.db,
        version.deploymentId,
        environmentId,
      );

      const policy = await getPolicy(
        ctx.db,
        environmentId,
        version.deploymentId,
      );

      if (policy?.environmentVersionRollout == null) return null;

      const releaseTargetRolloutInfoPromises = releaseTargets.map(
        (releaseTarget) =>
          getRolloutInfoForReleaseTarget(
            ctx.db,
            releaseTarget,
            policy,
            version,
          ),
      );

      const releaseTargetRolloutInfo = await Promise.all(
        releaseTargetRolloutInfoPromises,
      ).then((rows) =>
        rows.sort((a, b) => a.rolloutPosition - b.rolloutPosition),
      );

      return {
        releaseTargetRolloutInfo,
        rolloutPolicy: policy,
        environment,
        version,
      };
    }),
});
