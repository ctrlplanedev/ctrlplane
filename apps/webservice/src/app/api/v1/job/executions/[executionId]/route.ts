import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  job,
  release,
  releaseJobTrigger,
  target,
  updateJobExecution,
} from "@ctrlplane/db/schema";
import { onJobExecutionStatusChange } from "@ctrlplane/job-dispatch";

export const GET = async (
  _: NextRequest,
  { params }: { params: { executionId: string } },
) => {
  const je = await db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.id, job.jobConfigId))
    .leftJoin(environment, eq(environment.id, releaseJobTrigger.environmentId))
    .leftJoin(target, eq(target.id, releaseJobTrigger.targetId))
    .leftJoin(release, eq(release.id, releaseJobTrigger.releaseId))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .where(and(eq(job.id, params.executionId), isNull(environment.deletedAt)))
    .then(takeFirst)
    .then((row) => ({
      ...row.job,
      config: row.job_config,
      environment: row.environment,
      target: row.target,
      deployment: row.deployment,
      release: row.release,
    }));

  return NextResponse.json(je);
};

const bodySchema = updateJobExecution;

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { executionId: string } },
) => {
  const response = await req.json();
  const body = bodySchema.parse(response);

  const je = await db
    .update(job)
    .set(body)
    .where(and(eq(job.id, params.executionId)))
    .returning()
    .then(takeFirstOrNull);

  if (je == null)
    return NextResponse.json(
      { error: "Job execution not found" },
      { status: 404 },
    );

  onJobExecutionStatusChange(je).catch(console.error);

  return NextResponse.json(je);
};
