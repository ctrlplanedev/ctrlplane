import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
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
    { params: Promise<{ deploymentVersionId: string }> }
  >(async (ctx, { params }) => {
    const { deploymentVersionId } = await params;

    const deploymentVersion = await ctx.db.query.deploymentVersion.findFirst({
      where: eq(schema.deploymentVersion.id, deploymentVersionId),
      with: {
        deployment: {
          with: { system: { with: { environments: true } } },
        },
      },
    });

    if (deploymentVersion == null)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    const { deployment } = deploymentVersion;
    const { system } = deployment;
    const { environments } = system;

    const approvedAt =
      ctx.body.approvedAt != null ? new Date(ctx.body.approvedAt) : new Date();
    const recordsToInsert = environments.map((environment) => ({
      deploymentVersionId,
      userId: ctx.user.id,
      status: schema.ApprovalStatus.Approved,
      reason: ctx.body.reason,
      approvedAt,
      environmentId: environment.id,
    }));

    const createdRecords = await ctx.db
      .insert(schema.policyRuleAnyApprovalRecord)
      .values(recordsToInsert)
      .onConflictDoNothing()
      .returning();

    const affectedReleaseTargets = await ctx.db
      .select()
      .from(schema.releaseTarget)
      .where(
        eq(schema.releaseTarget.deploymentId, deploymentVersion.deploymentId),
      );

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
