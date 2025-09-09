import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  path: "/api/v1/release-targets/[releaseTargetId]/unpin",
});

const getReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

const getPinnedVersion = async (
  db: Tx,
  releaseTarget: schema.ReleaseTarget,
) => {
  const { desiredVersionId } = releaseTarget;
  if (desiredVersionId == null) return null;

  return db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, desiredVersionId))
    .then(takeFirstOrNull);
};

const unpinVersion = async (db: Tx, releaseTargetId: string) =>
  db
    .update(schema.releaseTarget)
    .set({ desiredVersionId: null })
    .where(eq(schema.releaseTarget.id, releaseTargetId));

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
  .handle<{ db: Tx }, { params: Promise<{ releaseTargetId: string }> }>(
    async ({ db }, { params }) => {
      try {
        const { releaseTargetId } = await params;

        const releaseTarget = await getReleaseTarget(db, releaseTargetId);
        if (releaseTarget == null)
          return NextResponse.json(
            { error: "Release target not found" },
            { status: NOT_FOUND },
          );

        const pinnedVersion = await getPinnedVersion(db, releaseTarget);
        if (pinnedVersion == null)
          return NextResponse.json(
            { error: "No version pinned" },
            { status: BAD_REQUEST },
          );

        await unpinVersion(db, releaseTargetId);
        await eventDispatcher.dispatchEvaluateReleaseTarget(releaseTarget);

        return NextResponse.json({ success: true });
      } catch (error) {
        log.error("Failed to unpin version", { error });
        return NextResponse.json(
          { error: "Failed to unpin version" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
