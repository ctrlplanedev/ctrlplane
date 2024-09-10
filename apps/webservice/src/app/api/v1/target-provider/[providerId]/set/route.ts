import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { buildConflictUpdateColumns, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createTarget,
  target,
  targetProvider,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

const bodySchema = z.object({
  targets: z.array(
    createTarget.omit({ lockedAt: true, providerId: true, workspaceId: true }),
  ),
});

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { providerId: string } },
) => {
  const query = await db
    .select()
    .from(targetProvider)
    .innerJoin(workspace, eq(workspace.id, targetProvider.workspaceId))
    .where(eq(targetProvider.id, params.providerId))
    .then(takeFirstOrNull);

  const provider = query?.target_provider;
  if (provider == null)
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const user = await getUser(req);
  if (user == null)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await can()
    .user(user.id)
    .perform(Permission.TargetUpdate)
    .on({ type: "targetProvider", id: params.providerId });

  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const response = await req.json();
  const body = await bodySchema.parseAsync(response);

  const results = await db
    .insert(target)
    .values(
      body.targets.map((t) => ({
        ...t,
        providerId: provider.id,
        workspaceId: provider.workspaceId,
        lockedAt: null,
      })),
    )
    .onConflictDoUpdate({
      target: [target.identifier, target.workspaceId],
      set: buildConflictUpdateColumns(target, ["labels"]),
    })
    .returning();

  return NextResponse.json({ targets: results });
};
