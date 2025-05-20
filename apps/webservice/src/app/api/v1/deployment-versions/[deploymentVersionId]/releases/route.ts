import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";

import { eq, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

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
  .handle<{ db: Tx }, { params: Promise<{ deploymentVersionId: string }> }>(
    async ({ db }, { params }) => {
      const { deploymentVersionId } = await params;

      const deploymentVersion = await db.query.deploymentVersion.findFirst({
        where: eq(SCHEMA.deploymentVersion.id, deploymentVersionId),
        with: { metadata: true },
      });

      if (deploymentVersion == null)
        return NextResponse.json(
          { error: "Deployment version not found" },
          { status: NOT_FOUND },
        );

      const variableReleaseSubquery = db
        .select({
          variableSetReleaseId: SCHEMA.variableSetRelease.id,
          variables: sql<Record<string, any>>`COALESCE(jsonb_object_agg(
          ${SCHEMA.variableValueSnapshot.key},
          ${SCHEMA.variableValueSnapshot.value}
        ) FILTER (WHERE ${SCHEMA.variableValueSnapshot.id} IS NOT NULL), '{}'::jsonb)`.as(
            "variables",
          ),
        })
        .from(SCHEMA.variableSetRelease)
        .leftJoin(
          SCHEMA.variableSetReleaseValue,
          eq(
            SCHEMA.variableSetRelease.id,
            SCHEMA.variableSetReleaseValue.variableSetReleaseId,
          ),
        )
        .leftJoin(
          SCHEMA.variableValueSnapshot,
          eq(
            SCHEMA.variableSetReleaseValue.variableValueSnapshotId,
            SCHEMA.variableValueSnapshot.id,
          ),
        )
        .groupBy(SCHEMA.variableSetRelease.id)
        .as("variableRelease");

      const releases = await db
        .select()
        .from(SCHEMA.release)
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .innerJoin(
          variableReleaseSubquery,
          eq(
            SCHEMA.release.variableReleaseId,
            variableReleaseSubquery.variableSetReleaseId,
          ),
        )
        .innerJoin(
          SCHEMA.releaseTarget,
          eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
        )
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
        )
        .where(eq(SCHEMA.versionRelease.versionId, deploymentVersionId))
        .limit(500);

      const fullReleases = releases.map((release) => ({
        resource: release.resource,
        environment: release.environment,
        deployment: release.deployment,
        version: {
          ...deploymentVersion,
          metadata: Object.fromEntries(
            deploymentVersion.metadata.map((m) => [m.key, m.value]),
          ),
        },
        variables: release.variableRelease.variables,
      }));

      return NextResponse.json(fullReleases);
    },
  );
