import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildConflictUpdateColumns, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createTarget,
  target,
  targetProvider,
  workspace,
} from "@ctrlplane/db/schema";

const bodySchema = z.object({
  targets: z.array(createTarget.omit({ providerId: true })),
});

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { workspace: string; providerId: string } },
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

  const response = await req.json();
  const body = bodySchema.parse(response);

  const results = await db
    .insert(target)
    .values(body.targets.map((t) => ({ ...t, providerId: provider.id })))
    .onConflictDoUpdate({
      target: [target.name, target.providerId],
      set: buildConflictUpdateColumns(target, ["labels"]),
    })
    .returning();

  return NextResponse.json({ targets: results });
};
