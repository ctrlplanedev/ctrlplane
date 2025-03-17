import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, isNull, notInArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { getUser } from "~/app/api/v1/auth";

export const GET = async (
  req: NextRequest,
  props: { params: Promise<{ agentId: string }> },
) => {
  const params = await props.params;
  const user = await getUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const je = await db
    .select()
    .from(SCHEMA.job)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .leftJoin(
      SCHEMA.environment,
      eq(SCHEMA.environment.id, SCHEMA.releaseJobTrigger.environmentId),
    )
    .leftJoin(
      SCHEMA.resource,
      eq(SCHEMA.resource.id, SCHEMA.releaseJobTrigger.resourceId),
    )
    .leftJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.deploymentVersion.id, SCHEMA.releaseJobTrigger.versionId),
    )
    .leftJoin(
      SCHEMA.deploymentVersionMetadata,
      eq(
        SCHEMA.deploymentVersionMetadata.versionId,
        SCHEMA.deploymentVersion.id,
      ),
    )
    .leftJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.id, SCHEMA.deploymentVersion.deploymentId),
    )
    .where(
      and(
        eq(SCHEMA.job.jobAgentId, params.agentId),
        notInArray(SCHEMA.job.status, [
          JobStatus.Failure,
          JobStatus.Cancelled,
          JobStatus.Skipped,
          JobStatus.Successful,
          JobStatus.InvalidJobAgent,
        ]),
        isNull(SCHEMA.resource.deletedAt),
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
            jobRows[0]!.deployment_version != null
              ? {
                  ...jobRows[0]!.deployment_version,
                  metadata: jobRows
                    .map((r) => r.deployment_version_metadata)
                    .filter(isPresent),
                }
              : null,
          version:
            jobRows[0]!.deployment_version != null
              ? {
                  ...jobRows[0]!.deployment_version,
                  metadata: jobRows
                    .map((r) => r.deployment_version_metadata)
                    .filter(isPresent),
                }
              : null,
        }))
        .value(),
    );

  return NextResponse.json(je);
};
