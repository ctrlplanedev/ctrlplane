import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { and, eq, isNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { deleteResources, upsertResources } from "@ctrlplane/job-dispatch";
import { variablesAES256 } from "@ctrlplane/secrets";
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
        .on({ type: "resource", id: extra.params.resourceId });
    }),
  )
  .handle(async ({ db }, { params }: { params: { resourceId: string } }) => {
    // we don't check deletedAt as we may be querying for soft-deleted resources
    const data = await db.query.resource.findFirst({
      where: eq(schema.resource.id, params.resourceId),
      with: { metadata: true, variables: true, provider: true },
    });

    if (data == null)
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );

    const { variables, metadata, ...resource } = data;
    const variable = Object.fromEntries(
      variables.map((v) => {
        const strval = String(v.value);
        const value = v.sensitive ? variablesAES256().decrypt(strval) : strval;
        return [v.key, value];
      }),
    );

    return NextResponse.json({
      ...resource,
      variable,
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
        .on({ type: "resource", id: extra.params.resourceId }),
    ),
  )
  .use(parseBody(patchSchema))
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: { resourceId: string } }
  >(async ({ db, body }, { params }) => {
    const isResource = eq(schema.resource.id, params.resourceId);
    const isNotDeleted = isNull(schema.resource.deletedAt);
    const where = and(isResource, isNotDeleted);
    const resource = await db.query.resource.findFirst({ where });

    if (resource == null)
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );

    const { updated } = await upsertResources(db, [_.merge(resource, body)]);
    const res = updated.at(0);
    if (res == null) throw new Error("Failed to update resource");
    return NextResponse.json(res);
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, extra }) =>
      can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: extra.params.resourceId }),
    ),
  )
  .handle(async ({ db }, { params }: { params: { resourceId: string } }) => {
    const isResource = eq(schema.resource.id, params.resourceId);
    const isNotDeleted = isNull(schema.resource.deletedAt);
    const where = and(isResource, isNotDeleted);
    const resource = await db.query.resource.findFirst({ where });

    if (resource == null)
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );

    await deleteResources(db, [resource]);
    return NextResponse.json({ success: true });
  });
