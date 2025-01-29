import { NextResponse } from "next/server";
import httpStatus from "http-status";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../auth";
import { parseBody } from "../body-parser";
import { request } from "../middleware";

const bodySchema = z.object({ slug: z.string() });

export const GET = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ ctx, can }) =>
      ctx.db
        .select()
        .from(SCHEMA.workspace)
        .where(eq(SCHEMA.workspace.slug, ctx.body.slug))
        .then(takeFirst)
        .then((workspace) =>
          can
            .perform(Permission.WorkspaceGet)
            .on({ type: "workspace", id: workspace.id }),
        ),
    ),
  )
  .handle<{ body: z.infer<typeof bodySchema> }>(async (ctx) => {
    try {
      const workspace = await ctx.db
        .select()
        .from(SCHEMA.workspace)
        .where(eq(SCHEMA.workspace.slug, ctx.body.slug))
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
