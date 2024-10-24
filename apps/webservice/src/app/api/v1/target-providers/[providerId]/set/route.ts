import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createTarget, targetProvider, workspace } from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

const bodySchema = z.object({
  targets: z.array(
    createTarget
      .omit({ lockedAt: true, providerId: true, workspaceId: true })
      .extend({
        metadata: z.record(z.string()).optional(),
        variables: z
          .array(
            z.object({
              key: z.string(),
              value: z.any(),
              sensitive: z.boolean(),
            }),
          )
          .optional(),
      }),
  ),
});

const canAccessTargetProvider = async (userId: string, providerId: string) =>
  can()
    .user(userId)
    .perform(Permission.TargetUpdate)
    .on({ type: "targetProvider", id: providerId });

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { providerId: string } },
) => {
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await canAccessTargetProvider(user.id, params.providerId);
  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const query = await db
    .select()
    .from(targetProvider)
    .innerJoin(workspace, eq(workspace.id, targetProvider.workspaceId))
    .where(eq(targetProvider.id, params.providerId))
    .then(takeFirstOrNull);

  const provider = query?.target_provider;
  if (!provider)
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  const body = await bodySchema.parseAsync(await req.json());
  const targetsToInsert = body.targets.map((t) => ({
    ...t,
    providerId: provider.id,
    workspaceId: provider.workspaceId,
  }));

  const targets = await upsertTargets(
    db,
    targetsToInsert.map((t) => ({
      ...t,
      variables: t.variables?.map((v) => ({
        ...v,
        value: v.value ?? null,
      })),
    })),
  );

  return NextResponse.json({ targets });
};
