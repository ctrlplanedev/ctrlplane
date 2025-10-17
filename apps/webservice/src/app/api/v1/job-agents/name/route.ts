import { NextResponse } from "next/server";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { jobAgent, workspace } from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const bodySchema = z.object({
  type: z.string(),
  name: z.string(),
  workspaceId: z.string().uuid(),
});

export const PATCH = request()
  .use(parseBody(bodySchema))
  .use(authn)
  .use(
    authz(({ can, ctx }) =>
      can
        .perform(Permission.SystemUpdate)
        .on({ type: "workspace", id: ctx.body.workspaceId }),
    ),
  )
  .handle<{ body: z.infer<typeof bodySchema> }>(async ({ db, body }) => {
    const ws = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, body.workspaceId))
      .then(takeFirstOrNull);

    if (ws == null)
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 },
      );

    const tp = await db
      .insert(jobAgent)
      .values(body)
      .onConflictDoUpdate({
        target: [jobAgent.workspaceId, jobAgent.name],
        set: body,
      })
      .returning()
      .then(takeFirst);

    await eventDispatcher.dispatchJobAgentCreated(tp);

    return NextResponse.json(tp);
  });
