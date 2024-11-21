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
        .on({ type: "system", id: params.systemId }),
    ),
  )
  .handle<unknown, { params: { systemId: string } }>(
    async (ctx, { params }) => {
      const system = await ctx.db.query.system.findFirst({
        where: eq(schema.system.id, params.systemId),
        with: {
          environments: true,
          deployments: true,
        },
      });
      if (system == null)
        return NextResponse.json(
          { error: "System not found" },
          { status: 404 },
        );
      return NextResponse.json(system);
    },
  );
