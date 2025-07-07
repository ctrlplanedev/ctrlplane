import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { INTERNAL_SERVER_ERROR, NOT_FOUND } from "http-status";
import { isPresent } from "ts-is-present";

import { desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { getJob } from "~/app/api/v1/jobs/[jobId]/get-job";
import { request } from "~/app/api/v1/middleware";

const log = logger.child({
  route: "/v1/release-targets/[releaseTargetId]/latest-jobs",
});

const getReleaseTarget = async (db: Tx, releaseTargetId: string) =>
  db
    .select()
    .from(schema.releaseTarget)
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .then(takeFirstOrNull);

const getLatestJobs = async (db: Tx, releaseTargetId: string) =>
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
    .where(eq(schema.releaseTarget.id, releaseTargetId))
    .orderBy(desc(schema.job.createdAt))
    .limit(10)
    .then((rows) => rows.map((row) => row.job));

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
      try {
        const { releaseTargetId } = await params;

        const releaseTarget = await getReleaseTarget(db, releaseTargetId);
        if (releaseTarget == null)
          return NextResponse.json(
            { error: "Release target not found" },
            { status: NOT_FOUND },
          );

        const latestJobs = await getLatestJobs(db, releaseTargetId);

        const fullJobs = await Promise.all(
          latestJobs.map((job) => getJob(db, job.id)),
        ).then((jobs) => jobs.filter(isPresent));

        return NextResponse.json(fullJobs);
      } catch (error) {
        log.error("Error getting latest jobs", {
          error,
        });
        return NextResponse.json(
          { error: "Failed to get latest jobs" },
          { status: INTERNAL_SERVER_ERROR },
        );
      }
    },
  );
