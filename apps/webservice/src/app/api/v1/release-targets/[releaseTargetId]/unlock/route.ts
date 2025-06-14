import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { isAfter } from "date-fns";
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
} from "http-status";

import { desc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "/v1/release-targets/{releaseTargetId}/unlock",
});

const getReleaseTarget = (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

const getLatestLockRecord = (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTargetLockRecord)
    .where(eq(schema.releaseTargetLockRecord.releaseTargetId, releaseTargetId))
    .orderBy(desc(schema.releaseTargetLockRecord.lockedAt))
    .limit(1)
    .then(takeFirstOrNull);

const getIsAlreadyUnlocked = (unlockedAt: Date | null) => {
  const now = new Date();
  return unlockedAt != null && isAfter(now, unlockedAt);
};

const unlockReleaseTarget = (db: Tx, lockRecordId: string) =>
  db
    .update(schema.releaseTargetLockRecord)
    .set({ unlockedAt: new Date() })
    .where(eq(schema.releaseTargetLockRecord.id, lockRecordId))
    .returning()
    .then(takeFirst);

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
  .handle<
    { user: schema.User },
    { params: Promise<{ releaseTargetId: string }> }
  >(async ({ db, user }, { params }) => {
    try {
      const { releaseTargetId } = await params;
      const releaseTarget = await getReleaseTarget(db, releaseTargetId);
      if (releaseTarget == null)
        return NextResponse.json(
          { error: "Release target not found" },
          { status: NOT_FOUND },
        );

      const latestLockRecord = await getLatestLockRecord(db, releaseTargetId);
      if (latestLockRecord == null)
        return NextResponse.json(
          { error: "Release target is not locked" },
          { status: BAD_REQUEST },
        );

      const isAlreadyUnlocked = getIsAlreadyUnlocked(
        latestLockRecord.unlockedAt,
      );
      if (isAlreadyUnlocked)
        return NextResponse.json(
          { error: "Release target is not locked" },
          { status: BAD_REQUEST },
        );

      const { lockedBy } = latestLockRecord;
      if (lockedBy !== user.id)
        return NextResponse.json(
          { error: "Release target was not locked by the current user" },
          { status: FORBIDDEN },
        );

      const unlock = await unlockReleaseTarget(db, latestLockRecord.id);
      await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);
      return NextResponse.json(unlock);
    } catch (error) {
      log.error(error);
      return NextResponse.json(
        { error: "Failed to unlock release target" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
