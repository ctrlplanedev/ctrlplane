import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  path: "/api/v1/deployments/[deploymentId]/versions",
});

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.DeploymentVersionList)
        .on({ type: "deployment", id: params.deploymentId ?? "" }),
    ),
  )
  .handle<{ db: Tx }, { params: Promise<{ deploymentId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { deploymentId } = await params;

        const deployment = await db
          .select()
          .from(schema.deployment)
          .where(eq(schema.deployment.id, deploymentId))
          .then(takeFirstOrNull);

        if (deployment == null)
          return NextResponse.json(
            { error: "Deployment not found" },
            { status: NOT_FOUND },
          );

        const versions = await db.query.deploymentVersion
          .findMany({
            where: eq(schema.deploymentVersion.deploymentId, deploymentId),
            with: { metadata: true },
            orderBy: desc(schema.deploymentVersion.createdAt),
            limit: 500,
          })
          .then((rows) =>
            rows.map((row) => ({
              ...row,
              metadata: Object.fromEntries(
                row.metadata.map(({ key, value }) => [key, value]),
              ),
            })),
          );

        return NextResponse.json(versions);
      } catch (error) {
        log.error(error);
        return NextResponse.json(
          { error: "Failed to list deployment versions" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
