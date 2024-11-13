import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  job,
  release,
  releaseJobTrigger,
  resource,
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
    .leftJoin(resource, eq(resource.id, releaseJobTrigger.resourceId))
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
      ),
    )
    .then((rows) =>
      rows.map((row) => ({
        ...row.job,
        config: row.release_job_trigger,
        environment: row.environment,
        target: row.resource,
        deployment: row.deployment,
        release: row.release,
      })),
    );

  return NextResponse.json(je);
};
