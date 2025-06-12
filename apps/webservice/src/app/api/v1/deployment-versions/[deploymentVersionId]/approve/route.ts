import { NextResponse } from "next/server";
import { NOT_FOUND } from "http-status";
import { z } from "zod";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
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
    });

    if (deploymentVersion == null)
      return NextResponse.json(
        { error: "Deployment version not found" },
        { status: NOT_FOUND },
      );

    const approvedAt =
      ctx.body.approvedAt != null ? new Date(ctx.body.approvedAt) : new Date();
    const record = await ctx.db
      .insert(schema.policyRuleAnyApprovalRecord)
      .values({
        deploymentVersionId,
        userId: ctx.user.id,
        status: schema.ApprovalStatus.Approved,
        reason: ctx.body.reason,
        approvedAt,
      })
      .onConflictDoNothing()
      .returning();

    const affectedReleaseTargets = await ctx.db
      .select()
      .from(schema.releaseTarget)
      .where(
        eq(schema.releaseTarget.deploymentId, deploymentVersion.deploymentId),
      );

    for (const releaseTarget of affectedReleaseTargets)
      await getQueue(Channel.EvaluateReleaseTarget).add(
        `${releaseTarget.resourceId}-${releaseTarget.environmentId}-${releaseTarget.deploymentId}`,
        releaseTarget,
      );

    return NextResponse.json(record);
  });
