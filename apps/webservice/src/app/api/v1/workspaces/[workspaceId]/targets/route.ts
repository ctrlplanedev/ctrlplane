import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import yaml from "js-yaml";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { db } from "@ctrlplane/db/client";
import { createTarget } from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { getUser } from "~/app/api/v1/auth";

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

const parseJson = (rawBody: string): object => {
  try {
    return JSON.parse(rawBody);
  } catch (e) {
    throw new Error("Invalid input: not valid JSON", { cause: e });
  }
};

const parseYaml = (rawBody: string) => {
  try {
    const targets: unknown[] = [];
    yaml.loadAll(rawBody, (obj) => targets.push(obj));
    return targets;
  } catch (e) {
    throw new Error("Invalid input: not valid YAML", { cause: e });
  }
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
  const contentType = req.headers.get("content-type");
  const parsedBody =
    contentType === "application/x-yaml" || contentType === "application/yaml"
      ? parseYaml(rawBody)
      : parseJson(rawBody);

  const parsedTargets = bodySchema.parse(parsedBody);
  if (parsedTargets.length === 0) return NextResponse.json({ count: 0 });

  const targets = await upsertTargets(
    db,
    parsedTargets.map((t) => ({ ...t, workspaceId })),
  );

  return NextResponse.json({ count: targets.length });
};
