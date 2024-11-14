import { NextResponse } from "next/server";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra }) => {
      const { workspaceId, identifier } = extra;

      const target = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
        ),
      });

      if (target == null) return false;
      return can
        .perform(Permission.ResourceGet)
        .on({ type: "resource", id: target.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
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
          { error: "Target not found" },
          { status: 404 },
        );

      const { metadata, ...target } = data;

      return NextResponse.json({
        ...target,
        metadata: Object.fromEntries(metadata.map((t) => [t.key, t.value])),
      });
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(async ({ can, extra }) => {
      const { workspaceId, identifier } = extra.params;

      const target = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, workspaceId),
          eq(schema.resource.identifier, identifier),
        ),
      });

      if (target == null) return false;
      return can
        .perform(Permission.ResourceDelete)
        .on({ type: "resource", id: target.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
      const target = await db.query.resource.findFirst({
        where: and(
          eq(schema.resource.workspaceId, params.workspaceId),
          eq(schema.resource.identifier, params.identifier),
        ),
      });

      if (target == null) {
        return NextResponse.json(
          { error: `Target not found for identifier: ${params.identifier}` },
          { status: 404 },
        );
      }

      await db.delete(schema.resource).where(eq(schema.resource.id, target.id));

      return NextResponse.json({ success: true });
    },
  );
