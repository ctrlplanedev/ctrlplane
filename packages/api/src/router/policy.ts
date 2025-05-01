import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  selector,
  takeFirst,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { policy } from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  FilterRule,
  mergePolicies,
  Policy,
  Version,
  versionAnyApprovalRule,
  versionRoleApprovalRule,
  versionUserApprovalRule,
} from "@ctrlplane/rule-engine";
import { createPolicyInTx, updatePolicyInTx } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const policyAiRouter = createTRPCRouter({
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
});

export const policyRouter = createTRPCRouter({
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
          eq(schema.policy.workspaceId, input.workspaceId),
          input.search != null
            ? ilike(schema.policy.name, `%${input.search}%`)
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
        orderBy: [desc(schema.policy.priority), asc(schema.policy.name)],
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
        where: eq(schema.policy.id, input.policyId),
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
    .input(schema.createPolicy)
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
    .input(z.object({ id: z.string().uuid(), data: schema.updatePolicy }))
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
        .delete(schema.policy)
        .where(eq(schema.policy.id, input))
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
    .input(schema.createPolicyTarget)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(schema.policyTarget)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  updateTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(schema.policyTarget)
          .where(eq(schema.policyTarget.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updatePolicyTarget }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.policyTarget)
        .set(input.data)
        .where(eq(schema.policyTarget.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  deleteTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(schema.policyTarget)
          .where(eq(schema.policyTarget.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(schema.policyTarget)
        .where(eq(schema.policyTarget.id, input))
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
    .input(schema.createPolicyRuleDenyWindow)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(schema.policyRuleDenyWindow)
        .values(input)
        .returning()
        .then(takeFirst);
    }),

  updateDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(schema.policyRuleDenyWindow)
          .where(eq(schema.policyRuleDenyWindow.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.updatePolicyRuleDenyWindow,
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(schema.policyRuleDenyWindow)
        .set(input.data)
        .where(eq(schema.policyRuleDenyWindow.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  deleteDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(schema.policyRuleDenyWindow)
          .where(eq(schema.policyRuleDenyWindow.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(schema.policyRuleDenyWindow)
        .where(eq(schema.policyRuleDenyWindow.id, input))
        .returning()
        .then(takeFirst),
    ),

  /**
   * Router for handling environment-specific policy evaluations. This router
   * provides endpoints for evaluating how policies apply to specific
   * environments and versions within those environments.
   */
  environmentPolicy: createTRPCRouter({
    /**
     * Evaluates whether a specific version can be deployed to a given
     * environment based on all applicable policies. This is a critical security
     * and compliance check that determines if a deployment should be allowed to
     * proceed.
     *
     * @param environmentId - The ID of the environment to evaluate against
     * @param versionId - The ID of the version being evaluated
     * @returns Object containing all applicable policies and their evaluation
     * results
     */
    evaluateVersion: protectedProcedure
      .input(
        z.object({
          environmentId: z.string().uuid(),
          versionId: z.string().uuid(),
        }),
      )
      .query(async ({ ctx, input: { environmentId, versionId } }) => {
        // First, find the environment and its associated workspace This is
        // needed to scope the policy search to the correct workspace
        const environment = await ctx.db.query.environment.findFirst({
          where: eq(schema.environment.id, environmentId),
          with: { system: { with: { workspace: true } } },
        });
        if (environment == null) throw new Error("Environment not found");

        const workspace = environment.system.workspace;

        // Find all policies that apply to this environment. This complex query
        // joins through the policy target chain to find policies that are
        // specifically targeted at this environment's release target
        const applicablePolicyIds = await ctx.db
          .selectDistinctOn([schema.policy.id], { policyId: schema.policy.id })
          .from(schema.policy)
          .innerJoin(
            schema.policyTarget,
            eq(schema.policy.id, schema.policyTarget.policyId),
          )
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
          .where(
            and(
              isNull(schema.policyTarget.resourceSelector),
              isNull(schema.policyTarget.deploymentSelector),
              eq(schema.policy.workspaceId, workspace.id),
              eq(schema.policy.enabled, true),
            ),
          )
          .then((r) => r.map((r) => r.policyId));

        // Load the full policy details including all their rules and conditions
        const policies = await ctx.db.query.policy.findMany({
          where: inArray(schema.policy.id, applicablePolicyIds),
          with: {
            denyWindows: true,
            deploymentVersionSelector: true,
            versionAnyApprovals: true,
            versionUserApprovals: true,
            versionRoleApprovals: true,
          },
        });

        // Get the version details including its metadata This is needed to
        // evaluate version-specific rules
        const candidateVersion = await ctx.db.query.deploymentVersion.findFirst(
          {
            where: eq(schema.deploymentVersion.id, versionId),
            with: {
              metadata: true,
            },
          },
        );
        if (candidateVersion == null)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Version not found",
          });

        // Format the version data for rule evaluation
        const version = [
          {
            ...candidateVersion,
            metadata: Object.fromEntries(
              candidateVersion.metadata.map((m) => [m.key, m.value]),
            ),
          },
        ];

        // Evaluate each type of approval rule These checks determine if the
        // version has the required approvals
        const userApprovals = await getApprovalReasons(
          policies,
          version,
          versionId,
          (policy) => versionUserApprovalRule(policy.versionUserApprovals),
        );

        const roleApprovals = await getApprovalReasons(
          policies,
          version,
          versionId,
          (policy) => versionRoleApprovalRule(policy.versionRoleApprovals),
        );

        const anyApprovals = await getApprovalReasons(
          policies,
          version,
          versionId,
          (policy) => versionAnyApprovalRule(policy.versionAnyApprovals),
        );

        // Return all evaluation results
        return {
          policies,
          rules: {
            userApprovals,
            roleApprovals,
            anyApprovals,
            versionSelector: Object.fromEntries(
              await Promise.all(
                policies.map(
                  async (p) =>
                    [p.id, await getVersionSelector(p, versionId)] as const,
                ),
              ),
            ),
          },
        };
      }),
  }),
});

/**
 * Evaluates whether a version matches a policy's version selector rules.
 * This is used to determine if a version is allowed to be deployed based on
 * policy-specific criteria like version numbers, tags, or other metadata.
 *
 * @param policy - The policy containing the version selector rules
 * @param versionId - The ID of the version being evaluated
 * @returns true if the version matches the selector rules, false otherwise
 */
const getVersionSelector = (policy: Policy, versionId: string) => {
  const selectorQuery =
    policy.deploymentVersionSelector?.deploymentVersionSelector;
  if (selectorQuery == null) return true;
  return db
    .select()
    .from(schema.deploymentVersion)
    .where(
      and(
        eq(schema.deploymentVersion.id, versionId),
        selector().query().deploymentVersions().where(selectorQuery).sql(),
      ),
    )
    .then((r) => r.length > 0);
};

/**
 * Evaluates approval rules for a set of policies and returns any rejection reasons.
 * This function is used to check if a version has the required approvals from
 * users, roles, or any other specified approvers.
 *
 * @param policies - The policies to evaluate
 * @param version - The version being evaluated
 * @param versionId - The ID of the version
 * @param ruleGetter - Function that extracts the relevant approval rules from a policy
 * @returns Object mapping policy IDs to arrays of rejection reasons
 */
const getApprovalReasons = async (
  policies: Policy[],
  version: Version[],
  versionId: string,
  ruleGetter: (policy: Policy) => Array<FilterRule<Version>>,
) => {
  return Object.fromEntries(
    await Promise.all(
      policies.map(async (policy) => {
        const rules = ruleGetter(policy);
        const rejectionReasons = await Promise.all(
          rules.map(async (rule) => {
            const result = await rule.filter(version);
            return result.rejectionReasons?.get(versionId) || null;
          }),
        );
        const o = rejectionReasons.filter(isPresent);
        return [policy.id, o] as const;
      }),
    ),
  );
};
