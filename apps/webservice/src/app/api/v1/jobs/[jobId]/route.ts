import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { request } from "~/app/api/v1/middleware";

type ApprovalJoinResult = {
  environment_policy_approval: typeof schema.environmentPolicyApproval.$inferSelect;
  user: typeof schema.user.$inferSelect | null;
};

const getApprovalDetails = async (releaseId: string, policyId: string) =>
  db
    .select()
    .from(schema.environmentPolicyApproval)
    .leftJoin(
      schema.user,
      eq(schema.environmentPolicyApproval.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.environmentPolicyApproval.releaseId, releaseId),
        eq(schema.environmentPolicyApproval.policyId, policyId),
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
    const rows = await db
      .select()
      .from(schema.job)
      .leftJoin(
        schema.runbookJobTrigger,
        eq(schema.runbookJobTrigger.jobId, schema.job.id),
      )
      .leftJoin(
        schema.runbook,
        eq(schema.runbookJobTrigger.runbookId, schema.runbook.id),
      )
      .leftJoin(
        schema.releaseJobTrigger,
        eq(schema.releaseJobTrigger.jobId, schema.job.id),
      )
      .leftJoin(
        schema.environment,
        eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
      )
      .leftJoin(
        schema.resource,
        eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
      )
      .leftJoin(
        schema.release,
        eq(schema.releaseJobTrigger.releaseId, schema.release.id),
      )
      .leftJoin(
        schema.deployment,
        eq(schema.release.deploymentId, schema.deployment.id),
      )
      .where(
        and(eq(schema.job.id, params.jobId), isNull(schema.resource.deletedAt)),
      );

    const row = rows.at(0);

    if (row == null)
      return NextResponse.json(
        { error: "Job execution not found." },
        { status: 404 },
      );

    const release =
      row.release != null ? { ...row.release, metadata: {} } : null;

    const je = {
      job: row.job,
      runbook: row.runbook,
      environment: row.environment,
      resource: row.resource,
      deployment: row.deployment,
      release,
    };

    const policyId = je.environment?.policyId;

    const approval =
      je.release?.id && policyId
        ? await getApprovalDetails(je.release.id, policyId)
        : undefined;

    const jobVariableRows = await db
      .select()
      .from(schema.jobVariable)
      .where(eq(schema.jobVariable.jobId, params.jobId));

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
      .from(schema.resourceMetadata)
      .where(eq(schema.resourceMetadata.resourceId, je.resource.id))
      .then((rows) => Object.fromEntries(rows.map((m) => [m.key, m.value])));

    return NextResponse.json({
      ...jobWithVariables,
      resource: { ...jobWithVariables.resource, metadata },
      approval,
    });
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
