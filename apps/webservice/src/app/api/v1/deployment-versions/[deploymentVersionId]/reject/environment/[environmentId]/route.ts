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

    if (!deploymentVersion)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    const environment = await db.query.environment.findFirst({
      where: eq(schema.environment.id, environmentId),
    });

    if (!environment)
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
    if (
      existingRecord != null &&
      existingRecord.status === schema.ApprovalStatus.Rejected
    )
      return NextResponse.json(
        { error: "User has already rejected this version and environment" },
        { status: CONFLICT },
      );

    const record = await db
      .insert(schema.policyRuleAnyApprovalRecord)
      .values({
        deploymentVersionId,
        userId: user.id,
        status: schema.ApprovalStatus.Rejected,
        reason: body.reason,
        approvedAt: null,
        environmentId,
      })
      .onConflictDoUpdate({
        target: [
          schema.policyRuleAnyApprovalRecord.deploymentVersionId,
          schema.policyRuleAnyApprovalRecord.environmentId,
          schema.policyRuleAnyApprovalRecord.userId,
        ],
        set: {
          status: schema.ApprovalStatus.Rejected,
          reason: body.reason,
        },
      })
      .returning();

    await Promise.all(
      record.map((record) =>
        eventDispatcher.dispatchUserApprovalRecordCreated(record),
      ),
    );

    return NextResponse.json(record);
  });
