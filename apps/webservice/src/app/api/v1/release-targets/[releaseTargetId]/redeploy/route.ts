import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "v1/release-targets/[releaseTargetId]/redeploy",
});

const getReleaseTarget = (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

export const POST = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.ReleaseTargetGet).on({
        type: "releaseTarget",
        id: params.releaseTargetId ?? "",
      }),
    ),
  )
  .handle<object, { params: Promise<{ releaseTargetId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { releaseTargetId } = await params;

        const releaseTarget = await getReleaseTarget(db, releaseTargetId);
        if (releaseTarget == null)
          return NextResponse.json(
            { error: "Release target not found" },
            { status: NOT_FOUND },
          );

        await eventDispatcher.dispatchEvaluateReleaseTarget(releaseTarget, {
          skipDuplicateCheck: true,
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        log.error("Failed to redeploy release target", { error });
        return NextResponse.json(
          { error: "Failed to redeploy release target" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
