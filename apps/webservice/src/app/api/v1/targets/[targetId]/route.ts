import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { upsertResources } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra }) => {
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: extra.params.targetId });
    }),
  )
  .handle(async ({ db }, { params }: { params: { targetId: string } }) => {
    const data = await db.query.resource.findFirst({
      where: eq(schema.resource.id, params.targetId),
      with: {
        metadata: true,
        variables: true,
        provider: true,
      },
    });

    if (data == null)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const { metadata, ...target } = data;

    return NextResponse.json({
      ...target,
      metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
    });
  });

const patchSchema = z.object({
  name: z.string().optional().optional(),
  version: z.string().optional().optional(),
  kind: z.string().optional().optional(),
  identifier: z.string().optional().optional(),
  workspaceId: z.string().optional().optional(),
  metadata: z.record(z.string()).optional(),
  variables: z
    .array(
      z.object({
        key: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
        sensitive: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const PATCH = request()
  .use(authn)
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resource", id: extra.params.targetId }),
    ),
  )
  .use(parseBody(patchSchema))
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: { targetId: string } }
  >(async ({ db, body }, { params }) => {
    const target = await db.query.resource.findFirst({
      where: eq(schema.resource.id, params.targetId),
    });

    if (target == null)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    const t = await upsertResources(db, [_.merge(target, body)]);

    return NextResponse.json(t[0]);
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: extra.params.targetId }),
    ),
  )
  .handle(async ({ db }, { params }: { params: { targetId: string } }) => {
    const target = await db.query.resource.findFirst({
      where: eq(schema.resource.id, params.targetId),
    });

    if (target == null)
      return NextResponse.json({ error: "Target not found" }, { status: 404 });

    await db
      .delete(schema.resource)
      .where(eq(schema.resource.id, params.targetId));

    return NextResponse.json({ success: true });
  });
