import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  asc,
  count,
  createPolicyInTx,
  desc,
  eq,
  takeFirst,
  updatePolicyInTx,
} from "@ctrlplane/db";
import {
  createPolicy,
  createPolicyRuleDenyWindow,
  createPolicyTarget,
  policy,
  policyRuleDenyWindow,
  policyTarget,
  updatePolicy,
  updatePolicyRuleDenyWindow,
  updatePolicyTarget,
} from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const policyRouter = createTRPCRouter({
  ai: createTRPCRouter({
    generateName: protectedProcedure
      .input(
        z.record(z.string(), z.any()).and(
          z.object({
            workspaceId: z.string().uuid(),
          }),
        ),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.PolicyCreate)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .mutation(async ({ input }) => {
        const { text } = await generateText({
          model: openai("gpt-4-turbo"),
          messages: [
            {
              role: "system",
              content: `
                You are a devops engineer assistant that generates names for policies.
                Based on the provided object for a Policy, generate a short title that describes 
                what the policy is about.
                
                The policy configuration can include:
                - Targets: Deployment and environment selectors that determine what this policy applies to
                - Deny Windows: Time windows when deployments are not allowed
                - Version Selector: Rules about which versions can be deployed
                - Approval Requirements: Any approvals needed from users or roles before deployment
                - If there are no targets, that means it won't be applied to any deployments
                - All approval rules are and operations. All conditions must be met before the policy allows a deployment
                
                Generate a concise name that captures the key purpose of the policy based on its configuration.
                The name should be no more than 50 characters.
                `,
            },
            {
              role: "user",
              content: JSON.stringify(
                _.omit(input, [
                  "workspaceId",
                  "id",
                  "description",
                  "createdAt",
                  "updatedAt",
                  "name",
                  "enabled",
                ]),
              ),
            },
          ],
        });

        return text
          .trim()
          .replaceAll("`", "")
          .replaceAll("'", "")
          .replaceAll('"', "");
      }),

    generateDescription: protectedProcedure
      .input(
        z.record(z.string(), z.any()).and(
          z.object({
            workspaceId: z.string().uuid(),
          }),
        ),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.PolicyCreate)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .mutation(async ({ input }) => {
        const { text } = await generateText({
          model: openai("gpt-4-turbo"),
          messages: [
            {
              role: "system",
              content: `
                You are a devops engineer assistant that generates descriptions for policies.
                Based on the provided object for a Policy, generate a description that explains
                the purpose and configuration. The description should cover:

                - Target deployments and environments
                - Time-based restrictions (deny windows)
                - Version deployment rules and requirements 
                - Required approvals from users or roles
                - If there are no targets, that means it won't be applied to any deployments
                - All approval rules are and operations. All conditions must be met before the 
                  policy allows a deployment
                - Focus on stating active policy configurations. Only describe features with enabled restrictions.

                Keep the description under 60 words and write it in a technical style suitable
                for DevOps engineers and platform users. Focus on being clear and precise about
                the controls and enforcement mechanisms. It is already clear that you are talking
                about the policy in question.

                Do not include phrases like "The policy...", "This policy...".
                `,
            },
            {
              role: "user",
              content: JSON.stringify(
                _.omit(input, [
                  "workspaceId",
                  "id",
                  "createdAt",
                  "updatedAt",
                  "enabled",
                  "priority",
                ]),
              ),
            },
          ],
        });

        return text
          .trim()
          .replaceAll("`", "")
          .replaceAll("'", "")
          .replaceAll('"', "");
      }),
  }),

  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.policy.findMany({
        where: eq(policy.workspaceId, input),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
          versionAnyApprovals: true,
          versionUserApprovals: true,
          versionRoleApprovals: true,
        },
        orderBy: [desc(policy.priority), asc(policy.name)],
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

      const counts = await Promise.all(
        policy.targets.map(async (target) => {
          const releaseTargets = await ctx.db
            .select({ count: count() })
            .from(schema.releaseTarget)
            .innerJoin(
              schema.deployment,
              eq(schema.releaseTarget.deploymentId, schema.deployment.id),
            )
            .innerJoin(
              schema.environment,
              eq(schema.releaseTarget.environmentId, schema.environment.id),
            )
            .innerJoin(
              schema.resource,
              eq(schema.releaseTarget.resourceId, schema.resource.id),
            )
            .where(
              and(
                schema.environmentMatchSelector(
                  ctx.db,
                  target.environmentSelector,
                ),
                schema.deploymentMatchSelector(target.deploymentSelector),
                schema.resourceMatchesMetadata(ctx.db, target.resourceSelector),
              ),
            );

          return releaseTargets.map((rt) => rt.count);
        }),
      );

      return { count: _.chain(counts).flatten().sum().value() };
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createPolicy)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((tx) => createPolicyInTx(tx, input)),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicy }))
    .mutation(({ ctx, input }) =>
      updatePolicyInTx(ctx.db, input.id, input.data),
    ),
  // ctx.db.transaction((tx) => updatePolicyInTx(tx, input.id, input.data)),
  // ),

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

  // Target endpoints
  createTarget: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(createPolicyTarget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(policyTarget).values(input).returning().then(takeFirst),
    ),

  updateTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(policyTarget)
          .where(eq(policyTarget.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicyTarget }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(policyTarget)
        .set(input.data)
        .where(eq(policyTarget.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  deleteTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(policyTarget)
          .where(eq(policyTarget.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policyTarget)
        .where(eq(policyTarget.id, input))
        .returning()
        .then(takeFirst),
    ),

  // Deny Window endpoints
  createDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(createPolicyRuleDenyWindow)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(policyRuleDenyWindow)
        .values(input)
        .returning()
        .then(takeFirst);
    }),

  updateDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(policyRuleDenyWindow)
          .where(eq(policyRuleDenyWindow.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(
      z.object({ id: z.string().uuid(), data: updatePolicyRuleDenyWindow }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(policyRuleDenyWindow)
        .set(input.data)
        .where(eq(policyRuleDenyWindow.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  deleteDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(policyRuleDenyWindow)
          .where(eq(policyRuleDenyWindow.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policyRuleDenyWindow)
        .where(eq(policyRuleDenyWindow.id, input))
        .returning()
        .then(takeFirst),
    ),
});
