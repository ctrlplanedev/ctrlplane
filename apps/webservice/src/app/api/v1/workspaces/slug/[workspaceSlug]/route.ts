import { NextResponse } from "next/server";
import httpStatus from "http-status";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../../auth";
import { request } from "../../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ ctx, can, extra: { params } }) =>
      ctx.db
        .select()
        .from(SCHEMA.workspace)
        .where(eq(SCHEMA.workspace.slug, params.workspaceSlug))
        .then(takeFirst)
        .then((workspace) =>
          can
            .perform(Permission.WorkspaceGet)
            .on({ type: "workspace", id: workspace.id }),
        ),
    ),
  )
  .handle<{ params: { workspaceSlug: string } }>(async (ctx) => {
    try {
      const workspace = await ctx.db
        .select()
        .from(SCHEMA.workspace)
        .where(eq(SCHEMA.workspace.slug, ctx.params.workspaceSlug))
        .then(takeFirstOrNull);

      if (workspace == null)
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: httpStatus.NOT_FOUND },
        );

      return NextResponse.json(workspace, { status: httpStatus.OK });
    } catch {
      return NextResponse.json(
        {
          error:
            "An error occurred while fetching the workspace, please contact support",
        },
        { status: httpStatus.INTERNAL_SERVER_ERROR },
      );
    }
  });
