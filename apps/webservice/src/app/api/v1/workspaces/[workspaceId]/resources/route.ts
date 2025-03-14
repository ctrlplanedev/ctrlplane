import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { resource, workspace } from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

const log = logger.child({
  module: "api/v1/workspaces/:workspaceId/resources",
});

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra: { params } }) =>
      can
        .perform(Permission.ResourceList)
        .on({ type: "workspace", id: (await params).workspaceId }),
    ),
  )
  .handle<unknown, { params: { workspaceId: string } }>(
    async (ctx, { params }) => {
      try {
        const { workspaceId } = await params;
        const resources = await ctx.db
          .select()
          .from(resource)
          .where(eq(resource.workspaceId, workspaceId))
          .orderBy(resource.name);
        return NextResponse.json(
          { data: resources },
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
