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

      const target = await db.query.target.findFirst({
        where: and(
          eq(schema.target.workspaceId, workspaceId),
          eq(schema.target.identifier, identifier),
        ),
      });

      if (target == null) return false;
      return can
        .perform(Permission.TargetGet)
        .on({ type: "target", id: target.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
      const data = await db.query.target.findFirst({
        where: and(
          eq(schema.target.workspaceId, params.workspaceId),
          eq(schema.target.identifier, params.identifier),
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
      const { workspaceId, identifier } = extra;
      const decodedIdentifier = decodeURIComponent(identifier);

      const target = await db.query.target.findFirst({
        where: and(
          eq(schema.target.workspaceId, workspaceId),
          eq(schema.target.identifier, decodedIdentifier),
        ),
      });

      if (target == null) return false;
      return can
        .perform(Permission.TargetDelete)
        .on({ type: "target", id: target.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; identifier: string } }>(
    async (_, { params }) => {
      const decodedIdentifier = decodeURIComponent(params.identifier);
      const target = await db.query.target.findFirst({
        where: and(
          eq(schema.target.workspaceId, params.workspaceId),
          eq(schema.target.identifier, decodedIdentifier),
        ),
      });

      if (target == null) {
        return NextResponse.json(
          { error: `Target not found for identifier: ${decodedIdentifier}` },
          { status: 404 },
        );
      }

      await db.delete(schema.target).where(eq(schema.target.id, target.id));

      return NextResponse.json({ success: true });
    },
  );
