import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  job,
  release,
  releaseJobTrigger,
  releaseMetadata,
  resource,
} from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

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
    .leftJoin(releaseMetadata, eq(releaseMetadata.releaseId, release.id))
    .leftJoin(deployment, eq(deployment.id, release.deploymentId))
    .where(
      and(
        eq(job.jobAgentId, params.agentId),
        notInArray(job.status, [
          JobStatus.Failure,
          JobStatus.Cancelled,
          JobStatus.Skipped,
          JobStatus.Successful,
          JobStatus.InvalidJobAgent,
        ]),
        isNull(resource.deletedAt),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((row) => row.job.id)
        .map((jobRows) => ({
          ...jobRows[0]!.job,
          config: jobRows[0]!.release_job_trigger,
          environment: jobRows[0]!.environment,
          target: jobRows[0]!.resource,
          deployment: jobRows[0]!.deployment,
          release:
            jobRows[0]!.release != null
              ? {
                  ...jobRows[0]!.release,
                  metadata: jobRows
                    .map((r) => r.release_metadata)
                    .filter(isPresent),
                }
              : null,
        }))
        .value(),
    );

  return NextResponse.json(je);
};
