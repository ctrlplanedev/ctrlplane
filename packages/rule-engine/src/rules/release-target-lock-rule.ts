import { isAfter } from "date-fns";

import { desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { PreValidationRule } from "../types";

type ReleaseTargetLockRuleOptions = {
  releaseTargetId: string;
  evaluationRequestedById?: string;
};

export class ReleaseTargetLockRule implements PreValidationRule {
  public readonly name = "ReleaseTargetLockRule";

  constructor(private readonly opts: ReleaseTargetLockRuleOptions) {}

  protected getCurrentTime() {
    return new Date();
  }

  protected async getLatestLockRecord() {
    return db
      .select()
      .from(schema.releaseTargetLockRecord)
      .where(
        eq(
          schema.releaseTargetLockRecord.releaseTargetId,
          this.opts.releaseTargetId,
        ),
      )
      .orderBy(desc(schema.releaseTargetLockRecord.lockedAt))
      .limit(1)
      .then(takeFirstOrNull);
  }

  async passing() {
    const latestLockRecord = await this.getLatestLockRecord();
    if (latestLockRecord == null) return { passing: true };

    const now = this.getCurrentTime();
    const { unlockedAt } = latestLockRecord;
    const isUnlocked = unlockedAt != null && isAfter(now, unlockedAt);
    if (isUnlocked) return { passing: true };

    const isLockedByCurrentUser =
      latestLockRecord.lockedBy === this.opts.evaluationRequestedById;
    if (isLockedByCurrentUser) return { passing: true };

    return {
      passing: false,
      rejectionReason: `Release target ${this.opts.releaseTargetId} is locked.`,
    };
  }
}
