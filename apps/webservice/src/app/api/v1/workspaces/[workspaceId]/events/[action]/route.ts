import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { and, desc, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) =>
      can
        .perform(Permission.EventList)
        .on({ type: "workspace", id: params.workspaceId ?? "" }),
    ),
  )
  .handle<
    unknown,
    { params: Promise<{ workspaceId: string; action: string }> }
  >(async ({ db }, { params }) => {
    try {
      const { workspaceId, action } = await params;

      const workspace = await db.query.workspace.findFirst({
        where: eq(schema.workspace.id, workspaceId),
      });

      if (workspace == null)
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: NOT_FOUND },
        );

      const events = await db.query.event.findMany({
        where: and(
          eq(schema.event.workspaceId, workspaceId),
          eq(schema.event.action, action),
        ),
        orderBy: desc(schema.event.createdAt),
        limit: 100,
      });

      return NextResponse.json(events);
    } catch (error) {
      logger.error(error);
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
