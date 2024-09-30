import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  job,
  release,
  releaseJobTrigger,
  target,
} from "@ctrlplane/db/schema";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  { params }: { params: { agentId: string } },
) => {
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const je = await db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
    .leftJoin(environment, eq(environment.id, releaseJobTrigger.environmentId))
    .leftJoin(target, eq(target.id, releaseJobTrigger.targetId))
    .leftJoin(release, eq(release.id, releaseJobTrigger.releaseId))
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
        config: row.release_job_trigger,
        environment: row.environment,
        target: row.target,
        deployment: row.deployment,
        release: row.release,
      })),
    );

  return NextResponse.json(je);
};
