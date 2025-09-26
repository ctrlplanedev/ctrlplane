import { z } from "zod";

import { eq, rulesAndTargets } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";
import { addRecord } from "./add-record";
import { byEnvironmentVersion } from "./approval-state";

const deleteAllRules = protectedProcedure
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser
        .perform(Permission.PolicyUpdate)
        .on({ type: "policy", id: input }),
  })
  .input(z.string().uuid())
  .mutation(async ({ ctx, input }) => {
    const prevPolicy = await ctx.db.query.policy.findFirst({
      where: eq(schema.policy.id, input),
      with: rulesAndTargets,
    });
    if (prevPolicy == null) throw new Error("Policy not found");

    await Promise.all([
      ctx.db
        .delete(schema.policyRuleAnyApproval)
        .where(eq(schema.policyRuleAnyApproval.policyId, input)),
      ctx.db
        .delete(schema.policyRuleUserApproval)
        .where(eq(schema.policyRuleUserApproval.policyId, input)),
      ctx.db
        .delete(schema.policyRuleRoleApproval)
        .where(eq(schema.policyRuleRoleApproval.policyId, input)),
    ]);

    const fullPolicy = await ctx.db.query.policy.findFirst({
      where: eq(schema.policy.id, input),
      with: rulesAndTargets,
    });

    if (fullPolicy == null) throw new Error("Policy not found");

    await eventDispatcher.dispatchPolicyUpdated(prevPolicy, fullPolicy);
  });

export const policyApprovalRouter = createTRPCRouter({
  byEnvironmentVersion,
  addRecord,
  deleteAllRules,
});
