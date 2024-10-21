import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import yaml from "js-yaml";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { db } from "@ctrlplane/db/client";
import { createTarget } from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "../../../auth";

const bodySchema = z.array(
  createTarget
    .omit({ lockedAt: true, providerId: true, workspaceId: true })
    .extend({ metadata: z.record(z.string()).optional() }),
);

const canUpsertTarget = async (userId: string, workspaceId: string) =>
  can()
    .user(userId)
    .perform(Permission.TargetCreate)
    .on({ type: "workspace", id: workspaceId });

const parseBody = (rawBody: string): object => {
  try {
    return JSON.parse(rawBody);
  } catch {
    try {
      const yamlResult = yaml.load(rawBody);
      if (typeof yamlResult === "object" && yamlResult !== null) {
        return yamlResult;
      }
    } catch {
      // YAML parsing failed
    }
  }
  throw new Error("Invalid input: not valid JSON or YAML");
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) => {
  const { workspaceId } = params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await canUpsertTarget(user.id, workspaceId);
  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const rawBody = await req.text();
  const parsedBody = parseBody(rawBody);
  const parsedTargets = bodySchema.parse(parsedBody);

  const targets = await upsertTargets(
    db,
    null,
    parsedTargets.map((t) => ({ ...t, workspaceId })),
  );

  return NextResponse.json({ count: targets.length });
};
