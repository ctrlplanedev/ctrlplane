import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { isAfter } from "date-fns";
import { CONFLICT, INTERNAL_SERVER_ERROR } from "http-status";

import { desc, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
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

const addLockRecord = async (
  db: Tx,
  releaseTargetId: string,
  lockedBy: string,
) =>
  db.transaction(async (tx) => {
    await tx.execute(
      sql`
        SELECT ${schema.releaseTarget.id} from ${schema.releaseTarget}
        WHERE ${eq(schema.releaseTarget.id, releaseTargetId)}
        FOR UPDATE
      `,
    );

    const lock = await tx
      .insert(schema.releaseTargetLockRecord)
      .values({ releaseTargetId, lockedBy })
      .returning()
      .then(takeFirst);

    return lock;
  });

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

      const lock = await addLockRecord(db, releaseTargetId, user.id);
      const lockedBy = { id: user.id, name: user.name, email: user.email };

      return NextResponse.json({
        ...lock,
        lockedBy,
      });
    } catch (error: any) {
      if ("code" in error && error.code === "55P03") {
        return NextResponse.json(
          { error: "Release target is currently locked" },
          { status: CONFLICT },
        );
      }

      if ("code" in error && error.code === "23505") {
        return NextResponse.json(
          { error: "Another user is already locking this release target" },
          { status: CONFLICT },
        );
      }

      log.error(error);
      return NextResponse.json(
        { error: "Failed to lock release target" },
        { status: INTERNAL_SERVER_ERROR },
      );
    }
  });
