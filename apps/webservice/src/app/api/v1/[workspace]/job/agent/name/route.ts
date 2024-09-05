import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent, workspace } from "@ctrlplane/db/schema";

import { getUser } from "~/app/api/v1/auth";

const bodySchema = z.object({ type: z.string(), name: z.string() });

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { workspace: string } },
) => {
  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.slug, params.workspace))
    .then(takeFirstOrNull);

  if (ws == null)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const canAccess = await getUser(req).then((u) =>
    u.access.workspace.id(ws.id),
  );
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
