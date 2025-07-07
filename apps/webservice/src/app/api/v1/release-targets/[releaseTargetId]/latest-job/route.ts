import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { authn, authz } from "~/app/api/v1/auth";
import { getJob } from "~/app/api/v1/jobs/[jobId]/get-job";
import { request } from "~/app/api/v1/middleware";

const getReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

const getLatestSuccessfulJob = async (db: Tx, releaseTargetId: string) =>
  db
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
        eq(schema.job.status, JobStatus.Successful),
        eq(schema.releaseTarget.id, releaseTargetId),
      ),
    )
    .orderBy(desc(schema.job.createdAt))
    .limit(1)
    .then(takeFirstOrNull)
    .then((row) => row?.job ?? null);

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, params }) =>
      can
        .perform(Permission.ReleaseTargetGet)
        .on({ type: "releaseTarget", id: params.releaseTargetId ?? "" }),
    ),
  )
  .handle<object, { params: Promise<{ releaseTargetId: string }> }>(
    async ({ db }, { params }) => {
      const { releaseTargetId } = await params;

      const releaseTarget = await getReleaseTarget(db, releaseTargetId);
      if (releaseTarget == null)
        return NextResponse.json(
          { error: "Release target not found" },
          { status: NOT_FOUND },
        );

      const latestSuccessfulJob = await getLatestSuccessfulJob(
        db,
        releaseTargetId,
      );
      if (latestSuccessfulJob == null)
        return NextResponse.json(
          { error: "No successful job found" },
          { status: NOT_FOUND },
        );

      const job = await getJob(db, latestSuccessfulJob.id);
      if (job == null)
        return NextResponse.json(
          { error: "Job not found" },
          { status: NOT_FOUND },
        );

      return NextResponse.json(job);
    },
  );
