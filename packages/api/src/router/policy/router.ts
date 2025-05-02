import _ from "lodash";
import { z } from "zod";

import { and, asc, desc, eq, ilike, takeFirst } from "@ctrlplane/db";
import { createPolicy, policy, updatePolicy } from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { createPolicyInTx, updatePolicyInTx } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { policyAiRouter } from "./ai";
import { policyDenyWindowRouter } from "./deny-window";
import { evaluate } from "./evaluate";
import { policyTargetRouter } from "./target";

export const policyRouter = createTRPCRouter({
  ai: policyAiRouter,
  target: policyTargetRouter,
  denyWindow: policyDenyWindowRouter,
  evaluate,

  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        search: z.string().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.policy.findMany({
        where: and(
          eq(policy.workspaceId, input.workspaceId),
          input.search != null
            ? ilike(policy.name, `%${input.search}%`)
            : undefined,
        ),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
          versionAnyApprovals: true,
          versionUserApprovals: true,
          versionRoleApprovals: true,
        },
        orderBy: [desc(policy.priority), asc(policy.name)],
        limit: input.limit,
      }),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyGet)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(
      z.object({
        policyId: z.string().uuid(),
        timeZone: z.string().default("UTC"),
      }),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.policy.findFirst({
        where: eq(policy.id, input.policyId),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
          versionAnyApprovals: true,
          versionUserApprovals: true,
          versionRoleApprovals: true,
        },
      }),
    ),

  releaseTargets: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyGet).on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.query.policy.findFirst({
        where: eq(schema.policy.id, input),
        with: {
          targets: true,
        },
      });
      if (policy == null) throw new Error("Policy not found");

      const releaseTargets = await ctx.db
        .select()
        .from(schema.policyTarget)
        .innerJoin(
          schema.computedPolicyTargetReleaseTarget,
          eq(
            schema.policyTarget.id,
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
          ),
        )
        .innerJoin(
          schema.releaseTarget,
          eq(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            schema.releaseTarget.id,
          ),
        )
        .innerJoin(
          schema.deployment,
          eq(schema.releaseTarget.deploymentId, schema.deployment.id),
        )
        .innerJoin(
          schema.resource,
          eq(schema.releaseTarget.resourceId, schema.resource.id),
        )
        .innerJoin(
          schema.environment,
          eq(schema.releaseTarget.environmentId, schema.environment.id),
        )
        .innerJoin(
          schema.system,
          eq(schema.environment.systemId, schema.system.id),
        )
        .where(and(eq(schema.policyTarget.policyId, input)))
        .then((r) =>
          r.map((rt) => ({
            ...rt.release_target,
            deployment: rt.deployment,
            resource: rt.resource,
            environment: rt.environment,
            system: rt.system,
          })),
        );

      return { releaseTargets, count: releaseTargets.length };
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createPolicy)
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.transaction((tx) =>
        createPolicyInTx(tx, input),
      );
      await getQueue(Channel.NewPolicy).add(policy.id, policy);
      return policy;
    }),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicy }))
    .mutation(async ({ ctx, input }) => {
      const policy = await ctx.db.transaction((tx) =>
        updatePolicyInTx(tx, input.id, input.data),
      );
      await getQueue(Channel.UpdatePolicy).add(policy.id, policy);
      return policy;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policy)
        .where(eq(policy.id, input))
        .returning()
        .then(takeFirst),
    ),
});
