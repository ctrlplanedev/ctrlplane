import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  path: "/api/v1/release-targets/[releaseTargetId]/pin",
});

const bodySchema = z.union([
  z.object({ versionId: z.string().uuid().nullable() }),
  z.object({ versionTag: z.string().nullable() }),
]);

const getIsVersionSetNull = (body: z.infer<typeof bodySchema>) =>
  ("versionId" in body && body.versionId == null) ||
  ("versionTag" in body && body.versionTag == null);

const getVersion = async (
  db: Tx,
  body: z.infer<typeof bodySchema>,
  releaseTarget: schema.ReleaseTarget,
) => {
  if ("versionId" in body && body.versionId != null)
    return db
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, body.versionId))
      .then(takeFirstOrNull);

  if ("versionTag" in body && body.versionTag != null)
    return db
      .select()
      .from(schema.deploymentVersion)
      .where(
        and(
          eq(schema.deploymentVersion.deploymentId, releaseTarget.deploymentId),
          eq(schema.deploymentVersion.tag, body.versionTag),
        ),
      )
      .then(takeFirstOrNull);

  return null;
};

const getReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

const pinVersion = async (db: Tx, releaseTargetId: string, versionId: string) =>
  db
    .update(schema.releaseTarget)
    .set({ desiredVersionId: versionId })
    .where(eq(schema.releaseTarget.id, releaseTargetId));

const unpinVersion = async (db: Tx, releaseTarget: schema.ReleaseTarget) => {
  if (releaseTarget.desiredVersionId == null)
    return NextResponse.json(
      { error: "No version pinned" },
      { status: BAD_REQUEST },
    );

  await db
    .update(schema.releaseTarget)
    .set({ desiredVersionId: null })
    .where(eq(schema.releaseTarget.id, releaseTarget.id));

  await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);

  return NextResponse.json({ success: true });
};

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
  .use(parseBody(bodySchema))
  .handle<
    { db: Tx; body: z.infer<typeof bodySchema> },
    { params: Promise<{ releaseTargetId: string }> }
  >(async ({ db, body }, { params }) => {
    try {
      const { releaseTargetId } = await params;

      const releaseTarget = await getReleaseTarget(db, releaseTargetId);
      if (releaseTarget == null)
        return NextResponse.json(
          { error: "Release target not found" },
          { status: NOT_FOUND },
        );

      const isVersionSetNull = getIsVersionSetNull(body);
      if (isVersionSetNull) return unpinVersion(db, releaseTarget);

      const version = await getVersion(db, body, releaseTarget);
      if (version == null)
        return NextResponse.json(
          { error: "Version not found" },
          { status: NOT_FOUND },
        );

      await pinVersion(db, releaseTargetId, version.id);
      await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);

      return NextResponse.json({ success: true });
    } catch (error) {
      log.error("Failed to pin version", { error });
      return NextResponse.json(
        { error: "Failed to pin version" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
