import { and, eq, notInArray, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { exitedStatus } from "@ctrlplane/validators/jobs";

import type { PreValidationRule } from "../types";

export class ReleaseTargetConcurrencyRule implements PreValidationRule {
  public readonly name = "ReleaseTargetConcurrencyRule";

  constructor(private readonly releaseTargetId: string) {}

  async passing() {
    const activeJob = await db
      .select()
      .from(schema.job)
      .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
      .innerJoin(
        schema.release,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .where(
        and(
          eq(schema.versionRelease.releaseTargetId, this.releaseTargetId),
          notInArray(schema.job.status, exitedStatus),
        ),
      )
      .limit(1)
      .then(takeFirstOrNull);

    if (activeJob == null) return { passing: true };

    const versionInfo = await db
      .select()
      .from(schema.deploymentVersion)
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(
        eq(schema.deploymentVersion.id, activeJob.version_release.versionId),
      )
      .then(takeFirst);

    const jobMetadata = await db
      .select()
      .from(schema.jobMetadata)
      .where(eq(schema.jobMetadata.jobId, activeJob.job.id))
      .then((rows) => Object.fromEntries(rows.map((r) => [r.key, r.value])));

    const jobInfo = {
      job: { ...activeJob.job, metadata: jobMetadata },
      version: versionInfo.deployment_version,
      deployment: versionInfo.deployment,
      system: versionInfo.system,
    };

    return {
      passing: false,
      rejectionReason: `Release target ${this.releaseTargetId} has an active job`,
      jobInfo,
    };
  }
}
