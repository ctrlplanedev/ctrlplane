import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  job,
  jobConfig,
  release,
  target,
} from "@ctrlplane/db/schema";

export const GET = async (
  _: NextRequest,
  { params }: { params: { agentId: string } },
) => {
  const je = await db
    .select()
    .from(job)
    .innerJoin(jobConfig, eq(jobConfig.id, job.jobConfigId))
    .leftJoin(environment, eq(environment.id, jobConfig.environmentId))
    .leftJoin(target, eq(target.id, jobConfig.targetId))
    .leftJoin(release, eq(release.id, jobConfig.releaseId))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .where(
      and(
        eq(job.jobAgentId, params.agentId),
        notInArray(job.status, [
          "failure",
          "cancelled",
          "skipped",
          "completed",
          "invalid_job_agent",
        ]),
        isNull(environment.deletedAt),
      ),
    )
    .then((rows) =>
      rows.map((row) => ({
        ...row.job,
        config: row.job_config,
        environment: row.environment,
        target: row.target,
        deployment: row.deployment,
        release: row.release,
      })),
    );

  return NextResponse.json(je);
};
