import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { z } from "zod";

import type { Tx } from "../common.js";
import { takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { getLocalDateAsUTC } from "./time-util.js";

type CreatePolicyInput = z.infer<typeof SCHEMA.createPolicy>;

const insertDenyWindows = async (
  tx: Tx,
  policyId: string,
  denyWindows: CreatePolicyInput["denyWindows"],
) => {
  if (denyWindows == null || denyWindows.length === 0) return;

  await tx.insert(SCHEMA.policyRuleDenyWindow).values(
    denyWindows.map((denyWindow) => {
      const dtstart =
        denyWindow.rrule?.dtstart != null
          ? getLocalDateAsUTC(denyWindow.rrule.dtstart, denyWindow.timeZone)
          : null;

      const dtend =
        denyWindow.dtend != null
          ? getLocalDateAsUTC(denyWindow.dtend, denyWindow.timeZone)
          : null;

      const rrule =
        denyWindow.rrule != null ? { ...denyWindow.rrule, dtstart } : undefined;

      return { ...denyWindow, rrule, dtend, policyId };
    }),
  );
};

export const createPolicyInTx = async (tx: Tx, input: CreatePolicyInput) => {
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
    .insert(SCHEMA.policy)
    .values(rest)
    .returning()
    .then(takeFirst);

  const { id: policyId } = policy;

  if (targets.length > 0)
    await tx
      .insert(SCHEMA.policyTarget)
      .values(targets.map((target) => ({ ...target, policyId })));

  await insertDenyWindows(tx, policyId, denyWindows);

  if (deploymentVersionSelector != null)
    await tx.insert(SCHEMA.policyRuleDeploymentVersionSelector).values({
      ...deploymentVersionSelector,
      policyId: policy.id,
      deploymentVersionSelector:
        deploymentVersionSelector.deploymentVersionSelector as DeploymentVersionCondition,
    });

  if (versionAnyApprovals != null)
    await tx
      .insert(SCHEMA.policyRuleAnyApproval)
      .values({ ...versionAnyApprovals, policyId });

  if (versionUserApprovals != null && versionUserApprovals.length > 0)
    await tx
      .insert(SCHEMA.policyRuleUserApproval)
      .values(
        versionUserApprovals.map((approval) => ({ ...approval, policyId })),
      );

  if (versionRoleApprovals != null && versionRoleApprovals.length > 0)
    await tx
      .insert(SCHEMA.policyRuleRoleApproval)
      .values(
        versionRoleApprovals.map((approval) => ({ ...approval, policyId })),
      );

  return {
    ...policy,
    targets,
    denyWindows,
    deploymentVersionSelector,
    versionAnyApprovals,
    versionUserApprovals,
    versionRoleApprovals,
  };
};
