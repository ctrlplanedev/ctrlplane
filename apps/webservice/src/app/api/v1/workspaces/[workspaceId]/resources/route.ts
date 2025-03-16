import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq } from "@ctrlplane/db";
import { resource } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

type ListRequestParams = { params: { workspaceId: string } };

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra: { params } }) =>
      can
        .perform(Permission.ResourceList)
        .on({ type: "workspace", id: (await params).workspaceId }),
    ),
  )
  .handle<unknown, Promise<ListRequestParams>>(async (ctx, extra) => {
    try {
      const { workspaceId } = (await extra).params;
      const resources = await ctx.db
        .select()
        .from(resource)
        .where(eq(resource.workspaceId, workspaceId))
        .orderBy(resource.name);
      return NextResponse.json({ data: resources }, { status: httpStatus.OK });
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
