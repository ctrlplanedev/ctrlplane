import type { Tx } from "@ctrlplane/db";
import type { Policy } from "@ctrlplane/rule-engine";
import { z } from "zod";

import { and, eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { mergePolicies } from "@ctrlplane/rule-engine";
import { getApplicablePoliciesWithoutResourceScope } from "@ctrlplane/rule-engine/db";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const getVersion = async (db: Tx, versionId: string) =>
  db
    .select()
    .from(schema.deploymentVersion)
    .where(eq(schema.deploymentVersion.id, versionId))
    .then(takeFirst);

const getAnyApprovalStateForPolicy = async (
  db: Tx,
  environmentId: string,
  versionId: string,
  policy: Policy | null,
): Promise<{
  requiredApprovalsCount: number;
  records: schema.PolicyRuleAnyApprovalRecord[];
}> => {
  const { versionAnyApprovals = null } = policy ?? {};
  if (versionAnyApprovals == null)
    return { requiredApprovalsCount: 0, records: [] };
  if (versionAnyApprovals.requiredApprovalsCount === 0)
    return { requiredApprovalsCount: 0, records: [] };

  const records = await db
    .select()
    .from(schema.policyRuleAnyApprovalRecord)
    .where(
      and(
        eq(schema.policyRuleAnyApprovalRecord.deploymentVersionId, versionId),
        eq(schema.policyRuleAnyApprovalRecord.environmentId, environmentId),
      ),
    );

  const { requiredApprovalsCount } = versionAnyApprovals;
  return { requiredApprovalsCount, records };
};

const getRoleApprovalStateForPolicy = async (
  db: Tx,
  environmentId: string,
  versionId: string,
  policy: Policy | null,
) => {
  const { versionRoleApprovals = [] } = policy ?? {};
};

const byEnvironmentVersion = protectedProcedure
  .input(
    z.object({
      environmentId: z.string().uuid(),
      versionId: z.string().uuid(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const { environmentId, versionId } = input;

    const version = await getVersion(ctx.db, versionId);
    const { deploymentId } = version;

    const policies = await getApplicablePoliciesWithoutResourceScope(
      ctx.db,
      environmentId,
      deploymentId,
    );
  });

export const policyApprovalRouter = createTRPCRouter({
  byEnvironmentVersion,
});
