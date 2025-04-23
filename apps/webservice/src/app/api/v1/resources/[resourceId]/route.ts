import { NextResponse } from "next/server";
import _ from "lodash";
import { z } from "zod";

import { and, eq, isNull, upsertResources } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { parseBody } from "../../body-parser";
import { request } from "../../middleware";

const log = logger.child({ module: "v1/resources/[resourceId]" });

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, params }) => {
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: params.resourceId ?? "" });
    }),
  )
  .handle(
    async ({ db }, { params }: { params: Promise<{ resourceId: string }> }) => {
      // we don't check deletedAt as we may be querying for soft-deleted resources
      const { resourceId } = await params;
      const data = await db.query.resource.findFirst({
        where: eq(schema.resource.id, resourceId),
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
          const value = v.sensitive
            ? variablesAES256().decrypt(strval)
            : strval;
          return [v.key, value];
        }),
      );

      return NextResponse.json({
        ...resource,
        variable,
        metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
      });
    },
  );

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
    authz(({ can, params }) =>
      can
        .perform(Permission.ResourceUpdate)
        .on({ type: "resource", id: params.resourceId ?? "" }),
    ),
  )
  .use(parseBody(patchSchema))
  .handle<
    { body: z.infer<typeof patchSchema> },
    { params: Promise<{ resourceId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { resourceId } = await params;
      const isResource = eq(schema.resource.id, resourceId);
      const isNotDeleted = isNull(schema.resource.deletedAt);
      const where = and(isResource, isNotDeleted);
      const resource = await db.query.resource.findFirst({ where });

      if (resource == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      const all = await upsertResources(db, resource.workspaceId, [
        _.merge(resource, body),
      ]);
      const res = all.at(0);

      if (res == null) throw new Error("Failed to update resource");

      const resourceWithMeta = {
        ...res,
        metadata: Object.fromEntries(res.metadata.map((m) => [m.key, m.value])),
      };
      return NextResponse.json(resourceWithMeta);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error(`Error updating resource: ${error}`);
      return NextResponse.json(
        { error: "Failed to update resource" },
        { status: 500 },
      );
    }
  });

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: params.resourceId ?? "" }),
    ),
  )
  .handle(
    async ({ db }, { params }: { params: Promise<{ resourceId: string }> }) => {
      const { resourceId } = await params;
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.id, resourceId),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      await getQueue(Channel.DeleteResource).add(resource.id, resource);
      return NextResponse.json({ success: true });
    },
  );
