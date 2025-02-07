import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { checkEntityPermissionForResource } from "@ctrlplane/auth/utils";
import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { resourceProvider, workspace } from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  props: { params: Promise<{ workspaceId: string; name: string }> }
) => {
  const params = await props.params;
  const ws = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, params.workspaceId))
    .then(takeFirstOrNull);

  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const user = await getUser(req);
  if (user == null)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await checkEntityPermissionForResource(
    { type: "user", id: user.id },
    { type: "workspace", id: ws.id },
    [Permission.ResourceGet],
  );
  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const tp = await db
    .insert(resourceProvider)
    .values({ name: params.name, workspaceId: ws.id })
    .onConflictDoUpdate({
      target: [resourceProvider.workspaceId, resourceProvider.name],
      set: { name: params.name },
    })
    .returning()
    .then(takeFirst);

  return NextResponse.json(tp);
};
