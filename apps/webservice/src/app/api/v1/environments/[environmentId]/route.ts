import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.SystemGet)
        .on({ type: "environment", id: params.environmentId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ environmentId: string }> }>(
    async (ctx, { params }) => {
      const { environmentId } = await params;
      const environment = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, environmentId),
        with: { policy: true, metadata: true },
      });
      if (environment == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );

      const metadata = Object.fromEntries(
        environment.metadata.map((m) => [m.key, m.value]),
      );
      return NextResponse.json({ ...environment, metadata });
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.SystemDelete)
        .on({ type: "environment", id: params.environmentId ?? "" }),
    ),
  )
  .handle<unknown, { params: Promise<{ environmentId: string }> }>(
    async (ctx, { params }) => {
      const { environmentId } = await params;
      const findEnv = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, environmentId),
      });
      if (findEnv == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );

      const environment = await ctx.db
        .delete(schema.environment)
        .where(eq(schema.environment.id, environmentId))
        .returning();

      return NextResponse.json(environment, { status: 200 });
    },
  );
