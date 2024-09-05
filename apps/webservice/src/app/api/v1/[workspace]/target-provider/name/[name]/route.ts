import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { targetProvider, workspace } from "@ctrlplane/db/schema";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  { params }: { params: { workspace: string; name: string } },
) => {
  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.slug, params.workspace))
    .then(takeFirstOrNull);

  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const canAccess = await getUser(req).then((u) =>
    u.access.workspace.id(ws.id),
  );
  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const tp = await db
    .insert(targetProvider)
    .values({ name: params.name, workspaceId: ws.id })
    .onConflictDoUpdate({
      target: [targetProvider.workspaceId, targetProvider.name],
      set: { name: params.name },
    })
    .returning()
    .then(takeFirst);

  return NextResponse.json(tp);
};
