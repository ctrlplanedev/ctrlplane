import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  jobConfig,
  jobExecution,
  release,
  runbook,
  target,
} from "@ctrlplane/db/schema";

export const GET = async (
  _: NextRequest,
  { params }: { params: { agentId: string } },
) => {
  const je = await db
    .select()
    .from(jobExecution)
    .innerJoin(jobConfig, eq(jobConfig.id, jobExecution.jobConfigId))
    .leftJoin(environment, eq(environment.id, jobConfig.environmentId))
    .leftJoin(runbook, eq(runbook.id, jobConfig.runbookId))
    .leftJoin(target, eq(target.id, jobConfig.targetId))
    .leftJoin(release, eq(release.id, jobConfig.releaseId))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .where(
      and(
        eq(jobExecution.jobAgentId, params.agentId),
        notInArray(jobExecution.status, [
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
        ...row.job_execution,
        config: row.job_config,
        environment: row.environment,
        runbook: row.runbook,
        target: row.target,
        deployment: row.deployment,
        release: row.release,
      })),
    );

  return NextResponse.json(je);
};
