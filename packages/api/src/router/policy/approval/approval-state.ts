import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import { and, desc, eq, inArray, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getApplicablePoliciesWithoutResourceScope } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../../trpc";

const getVersion = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, versionId))
    .then(takeFirst);

const getEnvironment = async (db: Tx, environmentId: string) =>
  db
    .select()
    .from(schema.environment)
    .where(eq(schema.environment.id, environmentId))
    .then(takeFirst);

const getMinimalUser = (user: schema.User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
});

const getAnyApprovalRecords = async (
  db: Tx,
  environmentId: string,
  versionId: string,
) => {
  const recordsWithUser = await db
    .select()
    .from(schema.policyRuleAnyApprovalRecord)
    .innerJoin(
      schema.user,
      eq(schema.policyRuleAnyApprovalRecord.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.policyRuleAnyApprovalRecord.deploymentVersionId, versionId),
        eq(schema.policyRuleAnyApprovalRecord.environmentId, environmentId),
      ),
    )
    .orderBy(desc(schema.policyRuleAnyApprovalRecord.createdAt));

  return recordsWithUser.map((recordResult) => ({
    ...recordResult.policy_rule_any_approval_record,
    user: getMinimalUser(recordResult.user),
  }));
};

const getRoleApprovalRecords = async (
  db: Tx,
  environmentId: string,
  versionId: string,
) => {
  const recordsWithUser = await db
    .select()
    .from(schema.policyRuleRoleApprovalRecord)
    .innerJoin(
      schema.user,
      eq(schema.policyRuleRoleApprovalRecord.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.policyRuleRoleApprovalRecord.deploymentVersionId, versionId),
        eq(schema.policyRuleRoleApprovalRecord.environmentId, environmentId),
      ),
    )
    .orderBy(desc(schema.policyRuleRoleApprovalRecord.createdAt));

  return recordsWithUser.map((recordResult) => ({
    ...recordResult.policy_rule_role_approval_record,
    user: getMinimalUser(recordResult.user),
  }));
};

const getUserApprovalRecords = async (
  db: Tx,
  environmentId: string,
  versionId: string,
) => {
  const recordsWithUser = await db
    .select()
    .from(schema.policyRuleUserApprovalRecord)
    .innerJoin(
      schema.user,
      eq(schema.policyRuleUserApprovalRecord.userId, schema.user.id),
    )
    .where(
      and(
        eq(schema.policyRuleUserApprovalRecord.deploymentVersionId, versionId),
        eq(schema.policyRuleUserApprovalRecord.environmentId, environmentId),
      ),
    )
    .orderBy(desc(schema.policyRuleUserApprovalRecord.createdAt));

  return recordsWithUser.map((recordResult) => ({
    ...recordResult.policy_rule_user_approval_record,
    user: getMinimalUser(recordResult.user),
  }));
};

const getApprovalRecords = async (
  db: Tx,
  environmentId: string,
  versionId: string,
) => {
  const [anyApprovalRecords, roleApprovalRecords, userApprovalRecords] =
    await Promise.all([
      getAnyApprovalRecords(db, environmentId, versionId),
      getRoleApprovalRecords(db, environmentId, versionId),
      getUserApprovalRecords(db, environmentId, versionId),
    ]);

  return {
    anyApprovalRecords,
    roleApprovalRecords,
    userApprovalRecords,
  };
};

const getUserApprovalRulesWithUser = async (
  db: Tx,
  versionUserApprovals: schema.PolicyRuleUserApproval[],
) =>
  db
    .select()
    .from(schema.policyRuleUserApproval)
    .innerJoin(
      schema.user,
      eq(schema.policyRuleUserApproval.userId, schema.user.id),
    )
    .where(
      inArray(
        schema.policyRuleUserApproval.id,
        versionUserApprovals.map((v) => v.id),
      ),
    )
    .then((rules) =>
      rules.map((rule) => ({
        ...rule.policy_rule_user_approval,
        user: getMinimalUser(rule.user),
      })),
    );

export const byEnvironmentVersion = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.EnvironmentGet).on({
        type: "environment",
        id: input.environmentId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { environmentId, versionId } = input;
    const environment = await getEnvironment(ctx.db, environmentId);
    const version = await getVersion(ctx.db, versionId);
    const { deploymentId } = version;

    const policies = await getApplicablePoliciesWithoutResourceScope(
      ctx.db,
      environmentId,
      deploymentId,
    ).then((policies) =>
      policies.filter(
        (p) =>
          p.versionAnyApprovals != null ||
          p.versionRoleApprovals.length > 0 ||
          p.versionUserApprovals.length > 0,
      ),
    );

    const policiesWithUserApprovals = await Promise.all(
      policies.map(async (p) => ({
        ...p,
        versionUserApprovals: await getUserApprovalRulesWithUser(
          ctx.db,
          p.versionUserApprovals,
        ),
      })),
    );

    const { anyApprovalRecords, roleApprovalRecords, userApprovalRecords } =
      await getApprovalRecords(ctx.db, environmentId, versionId);

    return {
      environment,
      version,
      policies: policiesWithUserApprovals,
      anyApprovalRecords,
      roleApprovalRecords,
      userApprovalRecords,
    };
  });
