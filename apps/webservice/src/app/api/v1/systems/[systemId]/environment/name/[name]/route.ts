import { NextResponse } from "next/server";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(async ({ can, extra: { params } }) => {
      return can
        .perform(Permission.SystemGet)
        .on({ type: "system", id: params.systemId });
    }),
  )
  .handle<unknown, { params: { systemId: string; name: string } }>(
    async (ctx, { params }) => {
      const environment = await ctx.db.query.environment.findFirst({
        where: and(
          eq(schema.environment.name, params.name),
          eq(schema.environment.systemId, params.systemId),
        ),
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
    authz(async ({ can, extra: { params } }) => {
      return can
        .perform(Permission.SystemDelete)
        .on({ type: "system", id: params.systemId });
    }),
  )
  .handle<unknown, { params: { systemId: string; name: string } }>(
    async (ctx, { params }) => {
      const findEnv = await ctx.db.query.environment.findFirst({
        where: and(
          eq(schema.environment.name, params.name),
          eq(schema.environment.systemId, params.systemId),
        ),
      });

      if (findEnv == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );

      const environment = await ctx.db
        .delete(schema.environment)
        .where(
          and(
            eq(schema.environment.name, params.name),
            eq(schema.environment.systemId, params.systemId),
          ),
        )
        .returning();

      return NextResponse.json(environment, { status: 200 });
    },
  );
