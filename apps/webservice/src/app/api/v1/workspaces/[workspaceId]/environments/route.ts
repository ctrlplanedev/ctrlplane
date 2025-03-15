import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { environment, system } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

type ListRequestParams = { params: { workspaceId: string } };

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra: { params } }) =>
      can
        .perform(Permission.EnvironmentList)
        .on({ type: "workspace", id: (await params).workspaceId }),
    ),
  )
  .handle<unknown, Promise<ListRequestParams>>(async (ctx, extra) => {
    try {
      const { workspaceId } = (await extra).params;
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
  });
