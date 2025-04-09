import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
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
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ input }) => {
        const { text } = await generateText({
          model: openai("gpt-4-turbo"),
          messages: [
            {
              role: "system",
              content: `
                You are a devops engineer assistant that generates names for policies.
                Based on the provided object for a Policy short title that describes 
                what the policy is about.  It should be no more than 20 characters.
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
      .input(z.record(z.string(), z.any()))
      .mutation(async ({ input }) => {
        const { text } = await generateText({
          model: openai("gpt-4-turbo"),
          messages: [
            {
              role: "system",
              content: `
                You are a devops engineer assistant that generates descriptions for policies.
                Based on the provided object for a Policy, generate a description that 
                describes what the policy is about.  It should be no more than 60 words.
                It should be written in the style of a policy description for technical 
                users. The description will be shown below the policy name in a UI.

                - High priority mean higher importance. It can be any integer value positive or negative.
                - The policy is for a software release deployment tool.
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
        with: { targets: true, denyWindows: true },
      }),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyGet).on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db.query.policy.findFirst({
        where: eq(policy.id, input),
        with: { targets: true, denyWindows: true },
      }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createPolicy)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const {
          targets,
          denyWindows,
          deploymentVersionSelector,
          versionAnyApprovals,
          versionUserApprovals,
          versionRoleApprovals,
          ...rest
        } = input;

        const policy = await tx
          .insert(schema.policy)
          .values(rest)
          .returning()
          .then(takeFirst);

        const { id: policyId } = policy;

        if (targets.length > 0) {
          await tx.insert(schema.policyTarget).values(
            targets.map((target) => ({
              ...target,
              policyId,
            })),
          );
        }

        if (denyWindows.length > 0) {
          await tx.insert(schema.policyRuleDenyWindow).values(
            denyWindows.map((denyWindow) => ({
              ...denyWindow,
              policyId,
            })),
          );
        }

        if (deploymentVersionSelector != null) {
          await tx.insert(schema.policyDeploymentVersionSelector).values({
            ...deploymentVersionSelector,
            policyId: policy.id,
            deploymentVersionSelector:
              deploymentVersionSelector.deploymentVersionSelector as DeploymentVersionCondition,
          });
        }

        if (versionAnyApprovals != null) {
          await tx
            .insert(schema.policyRuleAnyApproval)
            .values({ ...versionAnyApprovals, policyId });
        }

        if (versionUserApprovals.length > 0) {
          await tx.insert(schema.policyRuleUserApproval).values(
            versionUserApprovals.map((approval) => ({
              ...approval,
              policyId,
            })),
          );
        }

        if (versionRoleApprovals.length > 0) {
          await tx.insert(schema.policyRuleRoleApproval).values(
            versionRoleApprovals.map((approval) => ({
              ...approval,
              policyId,
            })),
          );
        }

        return policy;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicy }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(policy)
        .set(input.data)
        .where(eq(policy.id, input.id))
        .returning()
        .then(takeFirst);
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
