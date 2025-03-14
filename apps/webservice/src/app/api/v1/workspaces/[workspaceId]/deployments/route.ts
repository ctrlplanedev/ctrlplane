import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { deployment, system } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

type ListRequestParams = {params: {workspaceId: string}};

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra: { params } }) =>
      can
        .perform(Permission.DeploymentList)
        .on({ type: "workspace", id: (await params).workspaceId }),
    ),
  )
  .handle<unknown, Promise<ListRequestParams>>(
    async (ctx, extra) => {
      try {
          const { workspaceId } = (await extra).params;
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
