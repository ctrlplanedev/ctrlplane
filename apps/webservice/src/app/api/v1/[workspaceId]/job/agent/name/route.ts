import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent, workspace } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

const bodySchema = z.object({ type: z.string(), name: z.string() });

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) => {
  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, params.workspaceId))
    .then(takeFirstOrNull);

  if (ws == null)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const user = await getUser(req);
  if (user == null)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await can()
    .user(user.id)
    .perform(Permission.SystemUpdate)
    .on({ type: "workspace", id: ws.id });

  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const response = await req.json();
  const body = bodySchema.parse(response);

  const tp = await db
    .insert(jobAgent)
    .values({ ...body, workspaceId: ws.id })
    .onConflictDoUpdate({
      target: [jobAgent.workspaceId, jobAgent.name],
      set: body,
    })
    .returning()
    .then(takeFirst);

  return NextResponse.json(tp);
};
