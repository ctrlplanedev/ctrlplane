import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  DeploymentResourceContext,
  DeploymentResourcePolicy,
  DeploymentResourcePolicyResult,
  Release,
} from "./types.js";

/**
 * This policy ensures that only one deployment run can be active at a time.
 * It prevents multiple concurrent deployments from executing simultaneously.
 */
export class ResourceConcurrencyPolicy implements DeploymentResourcePolicy {
  public readonly name = "ResourceConcurrencyPolicy";

  constructor(private concurrencyLimit: number) {}

  private async getRunningCount(resourceId: string): Promise<number> {
    return db
      .select({ count: count() })
      .from(schema.job)
      .innerJoin(
        schema.releaseJobTrigger,
        eq(schema.job.id, schema.releaseJobTrigger.jobId),
      )
      .where(
        and(
          eq(schema.releaseJobTrigger.id, resourceId),
          eq(schema.job.status, JobStatus.InProgress),
        ),
      )

      .then((r) => r[0]?.count ?? 0);
  }

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourcePolicyResult> {
    const runningDeployments = await this.getRunningCount(ctx.deployment.id);

    if (runningDeployments >= this.concurrencyLimit)
      return {
        allowedReleases: [],
        reason: `Concurrency limit reached (${runningDeployments} of ${this.concurrencyLimit}). No new deployments allowed.`,
      };

    return { allowedReleases: currentCandidates };
  }
}
