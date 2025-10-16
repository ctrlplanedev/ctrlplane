import { z } from "zod";

import { and, eq, inArray } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { dispatchQueueJob, eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../../trpc";

export const addRecord = protectedProcedure
  .input(
    z.object({
      deploymentVersionId: z.string().uuid(),
      environmentIds: z.array(z.string().uuid()),
      status: z.nativeEnum(SCHEMA.ApprovalStatus),
      reason: z.string().optional(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.DeploymentVersionGet).on({
        type: "deploymentVersion",
        id: input.deploymentVersionId,
      }),
  })
  .mutation(async ({ ctx, input }) => {
    const { deploymentVersionId, environmentIds, status, reason } = input;

    const recordsToInsert = environmentIds.map((environmentId) => ({
      deploymentVersionId,
      environmentId,
      userId: ctx.session.user.id,
      status,
      reason,
      approvedAt: status === SCHEMA.ApprovalStatus.Approved ? new Date() : null,
    }));

    const record = await ctx.db
      .insert(SCHEMA.policyRuleAnyApprovalRecord)
      .values(recordsToInsert)
      .onConflictDoNothing()
      .returning();

    const affectedReleaseTargets = await ctx.db
      .select()
      .from(SCHEMA.deploymentVersion)
      .innerJoin(
        SCHEMA.releaseTarget,
        eq(
          SCHEMA.deploymentVersion.deploymentId,
          SCHEMA.releaseTarget.deploymentId,
        ),
      )
      .where(
        and(
          eq(SCHEMA.deploymentVersion.id, deploymentVersionId),
          environmentIds.length > 0
            ? inArray(SCHEMA.releaseTarget.environmentId, environmentIds)
            : undefined,
        ),
      )
      .then((rows) => rows.map((row) => row.release_target));

    await dispatchQueueJob()
      .toEvaluate()
      .releaseTargets(affectedReleaseTargets);

    await Promise.all(
      record.map((record) =>
        eventDispatcher.dispatchUserApprovalRecordCreated(record),
      ),
    );

    return record;
  });
