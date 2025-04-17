import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import type { z } from "zod";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../common.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { selector } from "../selectors/index.js";
import { getLocalDateAsUTC } from "./time-util.js";

type CreatePolicyInput = z.infer<typeof SCHEMA.createPolicy>;

const log = logger.child({ module: "policies/create" });

const insertDenyWindows = async (
  tx: Tx,
  policyId: string,
  denyWindows: CreatePolicyInput["denyWindows"],
) => {
  if (denyWindows == null || denyWindows.length === 0) return;

  await tx
    .insert(SCHEMA.policyRuleDenyWindow)
    .values(
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
          denyWindow.rrule != null
            ? { ...denyWindow.rrule, dtstart }
            : undefined;

        return { ...denyWindow, rrule, dtend, policyId };
      }),
    )
    .onConflictDoUpdate({
      target: [SCHEMA.policyRuleDenyWindow.id],
      set: buildConflictUpdateColumns(SCHEMA.policyRuleDenyWindow, [
        "dtend",
        "rrule",
        "timeZone",
      ]),
    });
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
    .onConflictDoUpdate({
      target: [SCHEMA.policy.workspaceId, SCHEMA.policy.name],
      set: buildConflictUpdateColumns(SCHEMA.policy, [
        "enabled",
        "description",
        "name",
        "priority",
      ]),
    })
    .returning()
    .then(takeFirst);

  const { id: policyId } = policy;

  if (targets.length > 0)
    await tx
      .insert(SCHEMA.policyTarget)
      .values(targets.map((target) => ({ ...target, policyId })))
      .onConflictDoUpdate({
        target: [SCHEMA.policyTarget.id],
        set: buildConflictUpdateColumns(SCHEMA.policyTarget, [
          "deploymentSelector",
          "environmentSelector",
          "resourceSelector",
        ]),
      });

  await insertDenyWindows(tx, policyId, denyWindows);

  if (deploymentVersionSelector != null)
    await tx
      .insert(SCHEMA.policyRuleDeploymentVersionSelector)
      .values({
        ...deploymentVersionSelector,
        policyId: policy.id,
        deploymentVersionSelector:
          deploymentVersionSelector.deploymentVersionSelector as DeploymentVersionCondition,
      })
      .onConflictDoUpdate({
        target: [SCHEMA.policyRuleDeploymentVersionSelector.id],
        set: buildConflictUpdateColumns(
          SCHEMA.policyRuleDeploymentVersionSelector,
          ["deploymentVersionSelector"],
        ),
      });

  if (versionAnyApprovals != null)
    await tx
      .insert(SCHEMA.policyRuleAnyApproval)
      .values({ ...versionAnyApprovals, policyId })
      .onConflictDoUpdate({
        target: [SCHEMA.policyRuleAnyApproval.id],
        set: buildConflictUpdateColumns(SCHEMA.policyRuleAnyApproval, [
          "requiredApprovalsCount",
        ]),
      });

  if (versionUserApprovals != null && versionUserApprovals.length > 0)
    await tx
      .insert(SCHEMA.policyRuleUserApproval)
      .values(
        versionUserApprovals.map((approval) => ({ ...approval, policyId })),
      )
      .onConflictDoUpdate({
        target: [SCHEMA.policyRuleUserApproval.id],
        set: buildConflictUpdateColumns(SCHEMA.policyRuleUserApproval, [
          "userId",
        ]),
      });

  if (versionRoleApprovals != null && versionRoleApprovals.length > 0)
    await tx
      .insert(SCHEMA.policyRuleRoleApproval)
      .values(
        versionRoleApprovals.map((approval) => ({ ...approval, policyId })),
      )
      .onConflictDoUpdate({
        target: [SCHEMA.policyRuleRoleApproval.id],
        set: buildConflictUpdateColumns(SCHEMA.policyRuleRoleApproval, [
          "roleId",
          "requiredApprovalsCount",
        ]),
      });

  selector()
    .compute()
    .policies([policyId])
    .releaseTargetSelectors()
    .catch((e) =>
      log.error(
        e,
        `Error replacing release target selectors for policy ${policyId}`,
      ),
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
