import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { system } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.SystemList)
        .on({ type: "workspace", id: params.workspaceId }),
    ),
  )
  .handle<unknown, { params: { workspaceId: string } }>(
    async (ctx, { params }) => {
      try {
        const { workspaceId } = await params;
        const systems = await ctx.db
          .select()
          .from(system)
          .where(eq(system.workspaceId, workspaceId))
          .orderBy(system.slug);
        return NextResponse.json({ data: systems }, { status: httpStatus.OK });
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
