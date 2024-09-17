import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

const canUpsertTargets = async (userId: string, workspaceId: string) =>
  can()
    .user(userId)
    .perform(Permission.TargetCreate)
    .on({ type: "workspace", id: workspaceId });

const bodySchema = z.object({
  targets: z.array(schema.createTarget.omit({ workspaceId: true })),
});

export const POST = async (
  req: NextRequest,
  { params }: { params: { workspace: string; name: string } },
) => {
  const workspace = await db
    .select()
    .from(schema.workspace)
    .where(eq(schema.workspace.slug, params.workspace))
    .then(takeFirstOrNull);
  if (!workspace)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canUpsert = await canUpsertTargets(user.id, workspace.id);
  if (!canUpsert)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );

  const targetProvider = await db
    .insert(schema.targetProvider)
    .values({ name: params.name, workspaceId: workspace.id })
    .onConflictDoUpdate({
      target: [schema.targetProvider.workspaceId, schema.targetProvider.name],
      set: { name: params.name },
    })
    .returning()
    .then(takeFirst);

  const targets = parsed.data.targets.map((target) => ({
    ...target,
    providerId: targetProvider.id,
    workspaceId: workspace.id,
  }));

  await upsertTargets(db, targets);

  return NextResponse.json({ targets: parsed.data.targets });
};
