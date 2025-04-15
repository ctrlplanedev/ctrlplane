import { NextResponse } from "next/server";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const DELETE = request()
  .use(authn)
  .use(
    authz(async ({ can, extra }) => {
      const { workspaceId, name } = extra.params;

      const policy = await db.query.policy.findFirst({
        where: and(
          eq(schema.policy.workspaceId, workspaceId),
          eq(schema.policy.name, name),
        ),
      });

      if (policy == null) return false;
      return can
        .perform(Permission.PolicyDelete)
        .on({ type: "policy", id: policy.id });
    }),
  )
  .handle<unknown, { params: { workspaceId: string; name: string } }>(
    async (_, { params }) => {
      const policy = await db.query.policy.findFirst({
        where: and(
          eq(schema.policy.workspaceId, params.workspaceId),
          eq(schema.policy.name, params.name),
        ),
      });

      if (policy == null) {
        return NextResponse.json(
          { error: `Policy not found for name: ${params.name}` },
          { status: 404 },
        );
      }

      await db.delete(schema.policy).where(eq(schema.policy.id, policy.id));

      return NextResponse.json({ success: true });
    },
  );
