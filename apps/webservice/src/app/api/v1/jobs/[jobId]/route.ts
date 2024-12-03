import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deployment,
  environment,
  environmentPolicyApproval,
  job,
  jobVariable,
  release,
  releaseJobTrigger,
  resource,
  resourceMetadata,
  runbook,
  runbookJobTrigger,
  updateJob,
  user,
} from "@ctrlplane/db/schema";
import { onJobCompletion, onJobFailure } from "@ctrlplane/job-dispatch";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

type ApprovalJoinResult = {
  environment_policy_approval: typeof environmentPolicyApproval.$inferSelect;
  user: typeof user.$inferSelect | null;
};

const getApprovalDetails = async (releaseId: string, policyId: string) =>
  db
    .select()
    .from(environmentPolicyApproval)
    .leftJoin(user, eq(environmentPolicyApproval.userId, user.id))
    .where(
      and(
        eq(environmentPolicyApproval.releaseId, releaseId),
        eq(environmentPolicyApproval.policyId, policyId),
      ),
    )
    .then(takeFirstOrNull)
    .then(mapApprovalResponse);

const mapApprovalResponse = (row: ApprovalJoinResult | null) =>
  !row
    ? null
    : {
        id: row.environment_policy_approval.id,
        status: row.environment_policy_approval.status,
        approver:
          row.user && row.environment_policy_approval.status !== "pending"
            ? {
                id: row.user.id,
                name: row.user.name,
              }
            : null,
      };

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
    const row = await db
      .select()
      .from(job)
      .leftJoin(runbookJobTrigger, eq(runbookJobTrigger.jobId, job.id))
      .leftJoin(runbook, eq(runbookJobTrigger.runbookId, runbook.id))
      .leftJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
      .leftJoin(
        environment,
        eq(environment.id, releaseJobTrigger.environmentId),
      )
      .leftJoin(resource, eq(resource.id, releaseJobTrigger.resourceId))
      .leftJoin(release, eq(release.id, releaseJobTrigger.releaseId))
      .leftJoin(deployment, eq(deployment.id, release.deploymentId))
      .where(and(eq(job.id, params.jobId), isNull(resource.deletedAt)))
      .then(takeFirstOrNull);

    if (row == null)
      return NextResponse.json(
        { error: "Job execution not found." },
        { status: 404 },
      );

    const je = {
      job: row.job,
      runbook: row.runbook,
      environment: row.environment,
      resource: row.resource,
      deployment: row.deployment,
      release: row.release,
    };

    const policyId = je.environment?.policyId;

    const approval =
      je.release?.id && policyId
        ? await getApprovalDetails(je.release.id, policyId)
        : undefined;

    const jobVariableRows = await db
      .select()
      .from(jobVariable)
      .where(eq(jobVariable.jobId, params.jobId));

    const variables = Object.fromEntries(
      jobVariableRows.map((v) => {
        const strval = String(v.value);
        const value = v.sensitive ? variablesAES256().decrypt(strval) : strval;
        return [v.key, value];
      }),
    );

    const jobWithVariables = { ...je, variables };
    if (je.resource == null) return NextResponse.json(jobWithVariables);

    const metadata = await db
      .select()
      .from(resourceMetadata)
      .where(eq(resourceMetadata.resourceId, je.resource.id))
      .then((rows) => Object.fromEntries(rows.map((m) => [m.key, m.value])));

    return NextResponse.json({
      ...jobWithVariables,
      resource: { ...jobWithVariables.resource, metadata },
      approval,
    });
  });

const bodySchema = updateJob;

export const PATCH = async (
  req: NextRequest,
  { params }: { params: { jobId: string } },
) => {
  const response = await req.json();
  const body = bodySchema.parse(response);

  const je = await db
    .update(job)
    .set(body)
    .where(and(eq(job.id, params.jobId)))
    .returning()
    .then(takeFirstOrNull);

  if (je == null)
    return NextResponse.json(
      { error: "Job execution not found" },
      { status: 404 },
    );

  if (je.status === JobStatus.Completed)
    onJobCompletion(je).catch(console.error);

  if (je.status === JobStatus.Failure) onJobFailure(je).catch(console.error);

  return NextResponse.json(je);
};
