import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import {
  getRolloutInfoForReleaseTarget,
  mergePolicies,
} from "@ctrlplane/rule-engine";
import { getApplicablePoliciesWithoutResourceScope } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route:
    "/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout",
});

const getDeploymentVersion = async (db: Tx, deploymentVersionId: string) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, deploymentVersionId))
    .then(takeFirstOrNull);

const getEnvironment = async (db: Tx, environmentId: string) =>
  db
    .select()
    .from(schema.environment)
    .where(eq(schema.environment.id, environmentId))
    .then(takeFirstOrNull);

const getReleaseTargets = async (
  db: Tx,
  deploymentId: string,
  environmentId: string,
) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
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
        deployment: row.deployment,
        environment: row.environment,
        resource: row.resource,
      })),
    );

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.DeploymentVersionGet).on({
        type: "deploymentVersion",
        id: params.deploymentVersionId ?? "",
      }),
    ),
  )
  .handle<
    { db: Tx },
    { params: Promise<{ deploymentVersionId: string; environmentId: string }> }
  >(async ({ db }, { params }) => {
    try {
      const { deploymentVersionId, environmentId } = await params;

      const deploymentVersion = await getDeploymentVersion(
        db,
        deploymentVersionId,
      );
      if (deploymentVersion == null)
        return NextResponse.json(
          { error: "Deployment version not found" },
          { status: NOT_FOUND },
        );

      const environment = await getEnvironment(db, environmentId);
      if (environment == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: NOT_FOUND },
        );

      const releaseTargets = await getReleaseTargets(
        db,
        deploymentVersion.deploymentId,
        environmentId,
      );

      const policies = await getApplicablePoliciesWithoutResourceScope(
        db,
        environmentId,
        deploymentVersion.deploymentId,
      );
      const policy = mergePolicies(policies);

      const releaseTargetsWithRolloutInfo = await Promise.all(
        releaseTargets.map((releaseTarget) =>
          getRolloutInfoForReleaseTarget(
            db,
            releaseTarget,
            policy,
            deploymentVersion,
          ),
        ),
      );

      const releaseTargetsSortedByRolloutPosition =
        releaseTargetsWithRolloutInfo.sort(
          (a, b) => a.rolloutPosition - b.rolloutPosition,
        );

      return NextResponse.json(releaseTargetsSortedByRolloutPosition);
    } catch (error) {
      log.error("Error getting rollout info", { error });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
