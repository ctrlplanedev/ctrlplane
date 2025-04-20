import { NextResponse } from "next/server";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra }) => {
      const { workspaceId, identifier } = extra;

      // we don't check deletedAt as we may be querying for soft-deleted resources
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
      // we don't check deletedAt as we may be querying for soft-deleted resources
      const data = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, params.workspaceId),
          eq(schema.resource.identifier, params.identifier),
        ),
        with: {
          metadata: true,
          variables: true,
          provider: true,
        },
      });

      if (data == null)
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );

      const { metadata, ...resource } = data;

      return NextResponse.json({
        ...resource,
        metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
      });
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(async ({ can, extra }) => {
      const { workspaceId, identifier } = extra.params;

      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null) return false;
      return can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: resource.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
      const resource = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, params.workspaceId),
          eq(schema.resource.identifier, params.identifier),
          isNull(schema.resource.deletedAt),
        ),
      });

      if (resource == null) {
        return NextResponse.json(
          { error: `Resource not found for identifier: ${params.identifier}` },
          { status: 404 },
        );
      }

      await getQueue(Channel.DeleteResource).add(resource.id, resource);

      return NextResponse.json({ success: true });
    },
  );
