import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { desc, eq, sql, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "v1/release-targets/[releaseTargetId]/releases",
});

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ReleaseTargetGet)
        .on({ type: "releaseTarget", id: params.releaseTargetId ?? "" }),
    ),
  )
  .handle<{ params: Promise<{ releaseTargetId: string }> }>(
    async ({ db, params }) => {
      try {
        const { releaseTargetId } = await params;

        const releaseTarget = await db
          .select()
          .from(schema.releaseTarget)
          .where(eq(schema.releaseTarget.id, releaseTargetId))
          .then(takeFirstOrNull);

        if (releaseTarget == null)
          return NextResponse.json(
            { error: "Release target not found" },
            { status: NOT_FOUND },
          );

        const variableSetReleaseSubquery = db
          .select({
            id: schema.variableSetRelease.id,
            values: sql<
              { key: string; value: unknown; sensitive: boolean }[]
            >`COALESCE(json_agg(json_build_object('key', ${schema.variableValueSnapshot.key}, 'value', ${schema.variableValueSnapshot.value}, 'sensitive', ${schema.variableValueSnapshot.sensitive})), '[]'::json)`.as(
              "values",
            ),
          })
          .from(schema.variableSetRelease)
          .leftJoin(
            schema.variableSetReleaseValue,
            eq(
              schema.variableSetRelease.id,
              schema.variableSetReleaseValue.variableSetReleaseId,
            ),
          )
          .leftJoin(
            schema.variableValueSnapshot,
            eq(
              schema.variableSetReleaseValue.variableValueSnapshotId,
              schema.variableValueSnapshot.id,
            ),
          )
          .as("variableSetReleaseSubquery");

        const releaseResult = await db
          .select()
          .from(schema.release)
          .innerJoin(
            schema.versionRelease,
            eq(schema.release.versionReleaseId, schema.versionRelease.id),
          )
          .innerJoin(
            schema.deploymentVersion,
            eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
          )
          .innerJoin(
            variableSetReleaseSubquery,
            eq(schema.release.variableReleaseId, variableSetReleaseSubquery.id),
          )
          .innerJoin(
            schema.deployment,
            eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
          )
          .where(eq(schema.versionRelease.releaseTargetId, releaseTargetId))
          .orderBy(desc(schema.release.createdAt))
          .limit(100);

        const releases = releaseResult.map((release) => {
          const { values } = release.variableSetReleaseSubquery;
          const variables = values.map(({ key, value, sensitive }) => {
            const strval = String(value);
            const resolvedValue = sensitive
              ? variablesAES256().decrypt(strval)
              : strval;
            return { key, value: resolvedValue };
          });

          return {
            deployment: release.deployment,
            version: release.deployment_version,
            variables,
          };
        });

        return NextResponse.json(releases);
      } catch (error) {
        log.error(error);
        return NextResponse.json(
          { error: "Error fetching releases" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
