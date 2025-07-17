import { and, count, eq, or, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { PreValidationRule } from "../types";

type ConcurrencyRuleOptions = {
  concurrency: number;
  policyId: string;
};

export class ConcurrencyRule implements PreValidationRule {
  public readonly name = "ConcurrencyRule";
  constructor(private readonly options: ConcurrencyRuleOptions) {}

  async getNumberOfActiveJobs() {
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
      .innerJoin(
        schema.computedPolicyTargetReleaseTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          schema.releaseTarget.id,
        ),
      )
      .where(
        and(
          eq(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            this.options.policyId,
          ),
          or(
            eq(schema.job.status, JobStatus.Pending),
            eq(schema.job.status, JobStatus.InProgress),
          ),
        ),
      )
      .then(takeFirst)
      .then(({ count }) => count);
  }

  async passing() {
    const numberOfActiveJobs = await this.getNumberOfActiveJobs();
    if (numberOfActiveJobs < this.options.concurrency) return { passing: true };

    return {
      passing: false,
      rejectionReason: `Concurrency limit of ${this.options.concurrency} reached.`,
    };
  }
}
