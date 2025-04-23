import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

const log = logger.child({
  module: "v1/resources/[resourceId]/release-targets",
});

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: params.resourceId ?? "" });
    }),
  )
  .handle(
    async ({ db }, { params }: { params: Promise<{ resourceId: string }> }) => {
      try {
        const { resourceId } = await params;

        const releaseTargetsRows = await db.query.releaseTarget.findMany({
          where: eq(schema.releaseTarget.resourceId, resourceId),
          with: {
            resource: true,
            environment: true,
            deployment: true,
          },
        });

        const releaseTargets = releaseTargetsRows.map((rt) => ({
          id: rt.id,
          resource: rt.resource,
          environment: rt.environment,
          deployment: rt.deployment,
        }));

        return NextResponse.json(releaseTargets);
      } catch (error) {
        log.error(error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }
    },
  );
