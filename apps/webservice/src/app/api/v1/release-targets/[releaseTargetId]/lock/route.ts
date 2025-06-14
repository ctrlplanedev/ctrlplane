import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { isAfter } from "date-fns";
import { CONFLICT, INTERNAL_SERVER_ERROR } from "http-status";

import { desc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "v1/release-targets/[releaseTargetId]/lock",
});

const isCurrentlyLocked = async (db: Tx, releaseTargetId: string) => {
  const latestLockRecord = await db
    .select()
    .from(schema.releaseTargetLockRecord)
    .where(eq(schema.releaseTargetLockRecord.releaseTargetId, releaseTargetId))
    .orderBy(desc(schema.releaseTargetLockRecord.lockedAt))
    .limit(1)
    .then(takeFirstOrNull);

  if (latestLockRecord == null) return false;

  const now = new Date();
  const { unlockedAt } = latestLockRecord;
  return unlockedAt == null || isAfter(unlockedAt, now);
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
  .handle<
    { user: schema.User },
    { params: Promise<{ releaseTargetId: string }> }
  >(async ({ db, user }, { params }) => {
    try {
      const { releaseTargetId } = await params;

      const isLocked = await isCurrentlyLocked(db, releaseTargetId);
      if (isLocked)
        return NextResponse.json(
          { error: "Release target is currently locked" },
          { status: CONFLICT },
        );

      const lock = await db
        .insert(schema.releaseTargetLockRecord)
        .values({ releaseTargetId, lockedBy: user.id })
        .returning()
        .then(takeFirst);

      const lockedBy = { id: user.id, name: user.name, email: user.email };

      return NextResponse.json({
        ...lock,
        lockedBy,
      });
    } catch (error) {
      log.error(error);
      return NextResponse.json(
        { error: "Failed to lock release target" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
