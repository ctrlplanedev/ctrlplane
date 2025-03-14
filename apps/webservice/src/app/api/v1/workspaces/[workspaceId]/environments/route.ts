import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { environment, system } from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

const log = logger.child({
  module: "api/v1/workspaces/:workspaceId/environments",
});

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.EnvironmentList)
        .on({ type: "workspace", id: params.workspaceId }),
    ),
  )
  .handle<unknown, { params: { workspaceId: string } }>(
    async (ctx, { params }) => {
      try {
        const { workspaceId } = await params;
        const environments = await ctx.db
          .select()
          .from(environment)
          .leftJoin(system, eq(system.id, environment.systemId))
          .where(eq(system.workspaceId, workspaceId))
          .orderBy(environment.name);
        return NextResponse.json(
          { data: environments },
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
