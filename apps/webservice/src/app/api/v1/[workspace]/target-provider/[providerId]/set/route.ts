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
import {
  cancelOldJobConfigsOnJobDispatch,
  createJobConfigs,
  createJobExecutionApprovals,
  dispatchJobConfigs,
  isPassingAllPolicies,
  isPassingReleaseSequencingCancelPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

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
  const body = bodySchema.parse(response);

  const results = await db
    .insert(target)
    .values(body.targets.map((t) => ({ ...t, providerId: provider.id })))
    .onConflictDoUpdate({
      target: [target.name, target.providerId],
      set: buildConflictUpdateColumns(target, ["labels"]),
    })
    .returning()
    .then((targets) =>
      createJobConfigs(db, "new_target")
        .causedById(user.id)
        .targets(targets.map((t) => t.id))
        .filter(isPassingReleaseSequencingCancelPolicy)
        .then(createJobExecutionApprovals)
        .insert()
        .then((jobConfigs) =>
          dispatchJobConfigs(db)
            .jobConfigs(jobConfigs)
            .filter(isPassingAllPolicies)
            .then(cancelOldJobConfigsOnJobDispatch)
            .dispatch(),
        ),
    );

  return NextResponse.json({ targets: results });
};
