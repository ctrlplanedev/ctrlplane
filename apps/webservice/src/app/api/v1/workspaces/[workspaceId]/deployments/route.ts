import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { deployment, system } from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

const log = logger.child({
  module: "api/v1/workspaces/:workspaceId/deployments",
});

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.DeploymentList)
        .on({ type: "workspace", id: params.workspaceId }),
    ),
  )
  .handle<unknown, { params: { workspaceId: string } }>(
    async (ctx, { params }) => {
      try {
        const { workspaceId } = await params;
        const deployments = await ctx.db
          .select()
          .from(deployment)
          .leftJoin(system, eq(system.id, deployment.systemId))
          .where(eq(system.workspaceId, workspaceId))
          .orderBy(deployment.slug);
        return NextResponse.json(
          { data: deployments },
          { status: httpStatus.OK },
        );
      } catch (error) {
        //console.dir(error);

        return NextResponse.json(
          {
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          { status: httpStatus.INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
