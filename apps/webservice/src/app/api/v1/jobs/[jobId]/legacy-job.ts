import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";

import { and, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";

type ApprovalJoinResult = {
  environment_policy_approval: typeof schema.environmentPolicyApproval.$inferSelect;
  user: typeof schema.user.$inferSelect | null;
};

const getApprovalDetails = async (
  db: Tx,
  versionId: string,
  policyId: string,
) =>
  db
    .select()
    .from(schema.environmentPolicyApproval)
    .leftJoin(
      schema.user,
      eq(schema.environmentPolicyApproval.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.environmentPolicyApproval.deploymentVersionId, versionId),
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

export const getLegacyJob = async (db: Tx, jobId: string) => {
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
      schema.deploymentVersion,
      eq(schema.releaseJobTrigger.versionId, schema.deploymentVersion.id),
    )
    .leftJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
    )
    .where(and(eq(schema.job.id, jobId), isNull(schema.resource.deletedAt)));

  const row = rows.at(0);

  if (row == null)
    return NextResponse.json(
      { error: "Job execution not found." },
      { status: 404 },
    );

  const deploymentVersion =
    row.deployment_version != null
      ? { ...row.deployment_version, metadata: {} }
      : null;

  const je = {
    job: row.job,
    runbook: row.runbook,
    environment: row.environment,
    resource: row.resource,
    deployment: row.deployment,
    deploymentVersion,
  };

  const policyId = je.environment?.policyId;

  const approval =
    je.deploymentVersion?.id && policyId
      ? await getApprovalDetails(db, je.deploymentVersion.id, policyId)
      : undefined;

  const jobVariableRows = await db
    .select()
    .from(schema.jobVariable)
    .where(eq(schema.jobVariable.jobId, jobId));

  const variables = Object.fromEntries(
    jobVariableRows.map((v) => {
      const strval = String(v.value);
      const value = v.sensitive ? variablesAES256().decrypt(strval) : strval;
      return [v.key, value];
    }),
  );

  const jobWithVariables = {
    ...je,
    variables,
    release:
      je.deploymentVersion != null
        ? { ...je.deploymentVersion, version: je.deploymentVersion.tag }
        : { version: undefined },
  };
  if (je.resource == null) return NextResponse.json(jobWithVariables);

  const metadata = await db
    .select()
    .from(schema.resourceMetadata)
    .where(eq(schema.resourceMetadata.resourceId, je.resource.id))
    .then((rows) => Object.fromEntries(rows.map((m) => [m.key, m.value])));

  return {
    ...jobWithVariables,
    resource: { ...jobWithVariables.resource, metadata },
    approval,
  };
};
