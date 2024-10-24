import type { SQL, Tx } from "@ctrlplane/db";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import yaml from "js-yaml";
import { z } from "zod";

import { can } from "@ctrlplane/auth/utils";
import { and, asc, eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createTarget } from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { upsertTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { targetCondition } from "@ctrlplane/validators/targets";

import { getUser } from "~/app/api/v1/auth";

const canGetTargets = async (userId: string, workspaceId: string) =>
  can()
    .user(userId)
    .perform(Permission.TargetList)
    .on({ type: "workspace", id: workspaceId });

type _StringStringRecord = Record<string, string>;
const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      target: schema.target,
      targetProvider: schema.targetProvider,
      workspace: schema.workspace,
      targetMetadata: sql<_StringStringRecord>`
        jsonb_object_agg(target_metadata.key, target_metadata.value) 
        FILTER (WHERE target_metadata.key IS NOT NULL)
      `.as("target_metadata"),
    })
    .from(schema.target)
    .leftJoin(
      schema.targetProvider,
      eq(schema.target.providerId, schema.targetProvider.id),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.target.workspaceId, schema.workspace.id),
    )
    .leftJoin(
      schema.targetMetadata,
      eq(schema.targetMetadata.targetId, schema.target.id),
    )
    .where(and(...checks))
    .groupBy(schema.target.id, schema.targetProvider.id, schema.workspace.id)
    .orderBy(asc(schema.target.kind), asc(schema.target.name));

const querySchema = z.object({
  limit: z.coerce.number().int().nonnegative().default(500),
  offset: z.coerce.number().int().nonnegative().default(0),
  filter: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      try {
        return JSON.parse(val);
      } catch {
        throw new Error("Invalid filter: not valid JSON");
      }
    })
    .pipe(targetCondition.optional()),
});

export const GET = async (
  req: NextRequest,
  { params }: { params: { workspaceId: string } },
) => {
  const { workspaceId } = params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canAccess = await canGetTargets(user.id, workspaceId);
  if (!canAccess)
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });

  const searchParams = req.nextUrl.searchParams;
  const { limit, offset, filter } = querySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    filter: searchParams.get("filter"),
  });
  const targetConditions = schema.targetMatchesMetadata(db, filter);
  const checks = [
    eq(schema.target.workspaceId, workspaceId),
    ...(targetConditions ? [targetConditions] : []),
  ];
  const items = await targetQuery(db, checks)
    .limit(limit)
    .offset(offset)
    .then((t) =>
      t.map((a) => ({
        ...a.target,
        provider: a.targetProvider,
        metadata: a.targetMetadata,
      })),
    );

  const total = await db
    .select({
      count: sql`COUNT(*)`.mapWith(Number),
    })
    .from(schema.target)
    .where(and(...checks))
    .then(takeFirst)
    .then((t) => t.count);
  return NextResponse.json({ items, total });
};

const bodySchema = z.array(
  createTarget
    .omit({ lockedAt: true, providerId: true, workspaceId: true })
    .extend({
      metadata: z.record(z.string()).optional(),
      variables: z
        .array(
          z.object({
            key: z.string(),
            value: z.string(),
            sensitive: z.boolean(),
          }),
        )
        .optional(),
    }),
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
