import { NextResponse } from "next/server";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "../../auth";
import { request } from "../../middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.SystemGet)
        .on({ type: "environment", id: params.environmentId }),
    ),
  )
  .handle<unknown, { params: { environmentId: string } }>(
    async (ctx, { params }) => {
      const environment = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, params.environmentId),
        with: {
          releaseChannels: true,
          policy: true,
        },
      });
      if (environment == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );
      return NextResponse.json(environment);
    },
  );

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.SystemDelete)
        .on({ type: "environment", id: params.environmentId }),
    ),
  )
  .handle<unknown, { params: { environmentId: string } }>(
    async (ctx, { params }) => {
      const findEnv = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, params.environmentId),
      });
      if (findEnv == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );

      const environment = await ctx.db
        .delete(schema.environment)
        .where(eq(schema.environment.id, params.environmentId))
        .returning();

      return NextResponse.json(environment, { status: 200 });
    },
  );
