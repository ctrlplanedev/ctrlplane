import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const approvalRouter = createTRPCRouter({
  byDeploymentVersionId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({
        versionId: z.string(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentPolicyApproval)
        .innerJoin(
          SCHEMA.environmentPolicy,
          eq(
            SCHEMA.environmentPolicy.id,
            SCHEMA.environmentPolicyApproval.policyId,
          ),
        )
        .leftJoin(
          SCHEMA.user,
          eq(SCHEMA.user.id, SCHEMA.environmentPolicyApproval.userId),
        )
        .where(
          and(
            ...[
              eq(
                SCHEMA.environmentPolicyApproval.deploymentVersionId,
                input.versionId,
              ),
              input.status
                ? eq(SCHEMA.environmentPolicyApproval.status, input.status)
                : null,
            ].filter(isPresent),
          ),
        )
        .then((p) =>
          p.map((r) => ({
            ...r.environment_policy_approval,
            policy: r.environment_policy,
            user: r.user,
          })),
        ),
    ),
  statusByVersionPolicyId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deploymentVersion", id: input.versionId }),
    })
    .input(
      z.object({ versionId: z.string().uuid(), policyId: z.string().uuid() }),
    )
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.environmentPolicyApproval)
        .where(
          and(
            eq(
              SCHEMA.environmentPolicyApproval.deploymentVersionId,
              input.versionId,
            ),
            eq(SCHEMA.environmentPolicyApproval.policyId, input.policyId),
          ),
        )
        .then(takeFirstOrNull),
    ),
});
