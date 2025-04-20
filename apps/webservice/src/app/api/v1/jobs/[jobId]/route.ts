import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";
import { getLegacyJob } from "./legacy-job";
import { getNewEngineJob } from "./new-engine-job";

export const GET = request()
  .use(authn)
  .use(
    authz(({ can, extra: { params } }) => {
      return can
        .perform(Permission.JobGet)
        .on({ type: "job", id: params.jobId });
    }),
  )
  .handle<object, { params: { jobId: string } }>(async ({ db }, { params }) => {
    // eslint-disable-next-line no-restricted-properties
    const isUsingNewEngine = process.env.ENABLE_NEW_POLICY_ENGINE === "true";
    const job = isUsingNewEngine
      ? await getNewEngineJob(db, params.jobId)
      : await getLegacyJob(db, params.jobId);

    if (job == null)
      return NextResponse.json(
        { error: "Job not found" },
        { status: NOT_FOUND },
      );

    return NextResponse.json(job);
  });

const bodySchema = schema.updateJob;

export const PATCH = async (
  req: NextRequest,
  props: { params: Promise<{ jobId: string }> },
) => {
  const params = await props.params;
  const response = await req.json();
  const body = bodySchema.parse(response);

  const job = await updateJob(db, params.jobId, body);

  return NextResponse.json(job);
};
