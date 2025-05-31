import { and, count, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { PreValidationRule } from "../types";

type ConcurrencyRuleOptions = {
  concurrency: number;
  getReleaseTargetsInConcurrencyGroup: () => Promise<schema.ReleaseTarget[]>;
};

export class ConcurrencyRule implements PreValidationRule {
  public readonly name = "ConcurrencyRule";
  constructor(private readonly options: ConcurrencyRuleOptions) {}

  async getNumberOfActiveJobs(releaseTargetsIds: string[]) {
    return db
      .select({ count: count() })
      .from(schema.job)
      .innerJoin(schema.releaseJob, eq(schema.job.id, schema.releaseJob.jobId))
      .innerJoin(
        schema.release,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .where(
        and(
          inArray(schema.releaseTarget.id, releaseTargetsIds),
          inArray(schema.job.status, [JobStatus.Pending, JobStatus.InProgress]),
        ),
      )
      .then(takeFirst)
      .then(({ count }) => count);
  }

  async passing() {
    const releaseTargets =
      await this.options.getReleaseTargetsInConcurrencyGroup();
    const releaseTargetsIds = releaseTargets.map((rt) => rt.id);
    const numberOfActiveJobs =
      await this.getNumberOfActiveJobs(releaseTargetsIds);
    if (numberOfActiveJobs < this.options.concurrency) return { passing: true };

    return {
      passing: false,
      rejectionReason: `Concurrency limit of ${this.options.concurrency} reached.`,
    };
  }
}
