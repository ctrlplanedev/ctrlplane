import { NextResponse } from "next/server";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const DELETE = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) =>
      can
        .perform(Permission.SystemGet)
        .on({ type: "system", id: params.systemId }),
    ),
  )
  .handle<unknown, { params: { systemId: string; name: string } }>(
    async (ctx, { params }) => {
      const environment = await ctx.db.query.environment.findFirst({
        where: and(
          eq(schema.environment.systemId, params.systemId),
          eq(schema.environment.name, params.name),
        ),
        with: {
          releaseChannels: true,
        },
      });
      if (environment == null)
        return NextResponse.json(
          { error: "Environment not found" },
          { status: 404 },
        );

      await ctx.db
        .delete(schema.environment)
        .where(
          and(
            eq(schema.environment.systemId, params.systemId),
            eq(schema.environment.name, params.name),
          ),
        );
      return NextResponse.json(environment);
    },
  );
