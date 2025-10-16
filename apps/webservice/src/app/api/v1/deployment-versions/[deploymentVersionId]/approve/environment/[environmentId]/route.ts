import type { Tx } from "@ctrlplane/db";
import { NextResponse } from "next/server";
import { CONFLICT, NOT_FOUND } from "http-status";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { authn, authz } from "~/app/api/v1/auth";
import { parseBody } from "~/app/api/v1/body-parser";
import { request } from "~/app/api/v1/middleware";

const bodySchema = z.object({
  reason: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
});

const getExistingRecord = async (
  db: Tx,
  deploymentVersionId: string,
  environmentId: string,
  userId: string,
) =>
  db.query.policyRuleAnyApprovalRecord.findFirst({
    where: and(
      eq(
        schema.policyRuleAnyApprovalRecord.deploymentVersionId,
        deploymentVersionId,
      ),
      eq(schema.policyRuleAnyApprovalRecord.environmentId, environmentId),
      eq(schema.policyRuleAnyApprovalRecord.userId, userId),
    ),
  });

export const POST = request()
  .use(authn)
  .use(parseBody(bodySchema))
  .use(
    authz(({ can, params }) =>
      can.perform(Permission.DeploymentVersionUpdate).on({
        type: "deploymentVersion",
        id: params.deploymentVersionId ?? "",
      }),
    ),
  )
  .handle<
    { body: z.infer<typeof bodySchema>; user: schema.User },
    { params: Promise<{ deploymentVersionId: string; environmentId: string }> }
  >(async ({ db, body, user }, { params }) => {
    const { deploymentVersionId, environmentId } = await params;

    const deploymentVersion = await db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.id, deploymentVersionId),
    });

    if (deploymentVersion == null)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    const environment = await db.query.environment.findFirst({
      where: eq(schema.environment.id, environmentId),
    });

    if (environment == null)
      return NextResponse.json(
        { error: "Environment not found" },
        { status: NOT_FOUND },
      );

    const existingRecord = await getExistingRecord(
      db,
      deploymentVersionId,
      environmentId,
      user.id,
    );

    if (existingRecord != null)
      return NextResponse.json(
        { error: "User has already approved this version and environment" },
        { status: CONFLICT },
      );

    const approvedAt =
      body.approvedAt != null ? new Date(body.approvedAt) : new Date();

    const createdRecords = await db
      .insert(schema.policyRuleAnyApprovalRecord)
      .values({
        deploymentVersionId,
        userId: user.id,
        status: schema.ApprovalStatus.Approved,
        reason: body.reason,
        approvedAt,
        environmentId,
      })
      .onConflictDoNothing()
      .returning();

    const affectedReleaseTargets = await db.query.releaseTarget.findMany({
      where: and(
        eq(schema.releaseTarget.deploymentId, deploymentVersion.deploymentId),
        eq(schema.releaseTarget.environmentId, environmentId),
      ),
    });

    await Promise.all(
      affectedReleaseTargets.map((rt) =>
        eventDispatcher.dispatchEvaluateReleaseTarget(rt),
      ),
    );

    await Promise.all(
      createdRecords.map((record) =>
        eventDispatcher.dispatchUserApprovalRecordCreated(record),
      ),
    );

    return NextResponse.json(createdRecords);
  });
