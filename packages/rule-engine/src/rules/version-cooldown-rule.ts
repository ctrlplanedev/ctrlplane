import { and, desc, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * A rule that enforces a cooldown period between deployments.
 *
 * This rule ensures a minimum amount of time passes between active releases for
 * a given deployment and resource.
 *
 * @example
 * ```ts
 * // Set a 24-hour cooldown period between deployments
 * new VersionCooldownRule({
 *   cooldownMinutes: 1440, // 24 hours
 * });
 * ```
 */
export class VersionCooldownRule implements DeploymentResourceRule {
  public readonly name = "VersionCooldownRule";

  constructor(
    private options: {
      cooldownMinutes: number;
    },
  ) {}

  private async getLastSuccessfulDeploymentTime(
    resourceId: string,
    versionId: string,
  ): Promise<Date | null> {
    const result = await db
      .select({ createdAt: schema.job.createdAt })
      .from(schema.job)
      .innerJoin(
        schema.releaseJobTrigger,
        eq(schema.job.id, schema.releaseJobTrigger.jobId),
      )
      .where(
        and(
          eq(schema.releaseJobTrigger.versionId, versionId),
          eq(schema.releaseJobTrigger.resourceId, resourceId),
          eq(schema.job.status, JobStatus.Successful),
        ),
      )
      .orderBy(desc(schema.job.createdAt))
      .limit(1);
    return result[0]?.createdAt ?? null;
  }

  async filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): Promise<DeploymentResourceRuleResult> {
    // Get the time of the last successful deployment
    const lastDeploymentTime = await this.getLastSuccessfulDeploymentTime(
      ctx.deployment.id,
      ctx.resource.id,
    );

    // If there's no previous deployment, cooldown doesn't apply
    if (lastDeploymentTime == null)
      return { allowedReleases: currentCandidates };

    // Check if the cooldown period has elapsed
    const cooldownMs = this.options.cooldownMinutes * 60 * 1000;
    const earliestAllowedTime = new Date(
      lastDeploymentTime.getTime() + cooldownMs,
    );

    const now = new Date();
    if (now > earliestAllowedTime) {
      return { allowedReleases: currentCandidates };
    }

    // Calculate remaining cooldown time
    const remainingMs = earliestAllowedTime.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingMins = remainingMinutes % 60;

    const remainingTimeStr =
      remainingHours > 0
        ? `${remainingHours} hour${remainingHours > 1 ? "s" : ""}${remainingMins > 0 ? ` ${remainingMins} minute${remainingMins > 1 ? "s" : ""}` : ""}`
        : `${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`;

    return {
      allowedReleases: [],
      reason: `Deployment cooldown period not yet elapsed. Please wait ${remainingTimeStr} before deploying again.`,
    };
  }
}
