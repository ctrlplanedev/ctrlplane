import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ReleaseTargetGet)
        .on({ type: "releaseTarget", id: params.releaseTargetId ?? "" }),
    ),
  )
  .handle<object, { params: Promise<{ releaseTargetId: string }> }>(
    async ({ db }, { params }) => {
      const { releaseTargetId } = await params;

      const releaseTarget = await db.query.releaseTarget.findFirst({
        where: eq(schema.releaseTarget.id, releaseTargetId),
        with: {
          deployment: true,
          resource: true,
          environment: true,
        },
      });

      if (releaseTarget == null)
        return NextResponse.json(
          { error: "Release target not found" },
          { status: NOT_FOUND },
        );

      return NextResponse.json(releaseTarget);
    },
  );
