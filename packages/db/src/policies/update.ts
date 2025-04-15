import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { eq } from "drizzle-orm";

import { logger } from "@ctrlplane/logger";

import type { Tx } from "../common.js";
import { buildConflictUpdateColumns, takeFirst } from "../common.js";
import * as SCHEMA from "../schema/index.js";
import { selector } from "../selectors/index.js";
import { getLocalDateAsUTC } from "./time-util.js";

const log = logger.child({ module: "policies/update" });

const updateTargets = async (
  tx: Tx,
  policyId: string,
  targets: SCHEMA.UpdatePolicy["targets"],
) => {
  if (targets == null) return;

  await tx
    .delete(SCHEMA.policyTarget)
    .where(eq(SCHEMA.policyTarget.policyId, policyId));

  if (targets.length === 0) return;

  await tx
    .insert(SCHEMA.policyTarget)
    .values(targets.map((target) => ({ ...target, policyId })));
};

const updateDenyWindows = async (
  tx: Tx,
  policyId: string,
  denyWindows: SCHEMA.UpdatePolicy["denyWindows"],
) => {
  if (denyWindows == null) return;

  await tx
    .delete(SCHEMA.policyRuleDenyWindow)
    .where(eq(SCHEMA.policyRuleDenyWindow.policyId, policyId));
  if (denyWindows.length === 0) return;

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

const updateDeploymentVersionSelector = async (
  tx: Tx,
  policyId: string,
  deploymentVersionSelector: SCHEMA.UpdatePolicy["deploymentVersionSelector"],
) => {
  if (deploymentVersionSelector === undefined) return;
  if (deploymentVersionSelector === null)
    return tx
      .delete(SCHEMA.policyRuleDeploymentVersionSelector)
      .where(eq(SCHEMA.policyRuleDeploymentVersionSelector.policyId, policyId));

  await tx
    .insert(SCHEMA.policyRuleDeploymentVersionSelector)
    .values({
      ...deploymentVersionSelector,
      policyId,
      deploymentVersionSelector:
        deploymentVersionSelector.deploymentVersionSelector as DeploymentVersionCondition,
    })
    .onConflictDoUpdate({
      target: [SCHEMA.policyRuleDeploymentVersionSelector.policyId],
      set: buildConflictUpdateColumns(
        SCHEMA.policyRuleDeploymentVersionSelector,
        ["name", "description", "deploymentVersionSelector"],
      ),
    });
};

const updateVersionAnyApprovals = async (
  tx: Tx,
  policyId: string,
  versionAnyApprovals: SCHEMA.UpdatePolicy["versionAnyApprovals"],
) => {
  if (versionAnyApprovals === undefined) return;
  if (versionAnyApprovals === null)
    return tx
      .delete(SCHEMA.policyRuleAnyApproval)
      .where(eq(SCHEMA.policyRuleAnyApproval.policyId, policyId));

  await tx.update(SCHEMA.policyRuleAnyApproval).set({
    ...versionAnyApprovals,
    policyId,
  });
};

const updateVersionUserApprovals = async (
  tx: Tx,
  policyId: string,
  versionUserApprovals: SCHEMA.UpdatePolicy["versionUserApprovals"],
) => {
  if (versionUserApprovals == null) return;

  await tx
    .delete(SCHEMA.policyRuleUserApproval)
    .where(eq(SCHEMA.policyRuleUserApproval.policyId, policyId));

  if (versionUserApprovals.length === 0) return;

  await tx
    .insert(SCHEMA.policyRuleUserApproval)
    .values(
      versionUserApprovals.map((approval) => ({ ...approval, policyId })),
    );
};

const updateVersionRoleApprovals = async (
  tx: Tx,
  policyId: string,
  versionRoleApprovals: SCHEMA.UpdatePolicy["versionRoleApprovals"],
) => {
  if (versionRoleApprovals == null) return;

  await tx
    .delete(SCHEMA.policyRuleRoleApproval)
    .where(eq(SCHEMA.policyRuleRoleApproval.policyId, policyId));

  if (versionRoleApprovals.length === 0) return;

  await tx
    .insert(SCHEMA.policyRuleRoleApproval)
    .values(
      versionRoleApprovals.map((approval) => ({ ...approval, policyId })),
    );
};

export const updatePolicyInTx = async (
  tx: Tx,
  id: string,
  input: SCHEMA.UpdatePolicy,
) => {
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
    .select()
    .from(SCHEMA.policy)
    .where(eq(SCHEMA.policy.id, id))
    .then(takeFirst);

  if (Object.values(rest).length > 0)
    await tx
      .update(SCHEMA.policy)
      .set(rest)
      .where(eq(SCHEMA.policy.id, id))
      .returning()
      .then(takeFirst);

  await Promise.all([
    updateTargets(tx, policy.id, targets),
    updateDenyWindows(tx, policy.id, denyWindows),
    updateDeploymentVersionSelector(tx, policy.id, deploymentVersionSelector),
    updateVersionAnyApprovals(tx, policy.id, versionAnyApprovals),
    updateVersionUserApprovals(tx, policy.id, versionUserApprovals),
    updateVersionRoleApprovals(tx, policy.id, versionRoleApprovals),
  ]);

  const updatedPolicy = await tx.query.policy.findFirst({
    where: eq(SCHEMA.policy.id, id),
    with: {
      targets: true,
      denyWindows: true,
      deploymentVersionSelector: true,
      versionAnyApprovals: true,
      versionUserApprovals: true,
      versionRoleApprovals: true,
    },
  });

  if (updatedPolicy == null) throw new Error("Policy not found");

  const policyTargetsComputer = selector().compute().policies([policy.id]);
  policyTargetsComputer
    .deploymentSelectors()
    .replace()
    .catch((e) =>
      log.error(
        e,
        `Error replacing deployment selectors for policy ${policy.id}`,
      ),
    );
  policyTargetsComputer
    .environmentSelectors()
    .replace()
    .catch((e) =>
      log.error(
        e,
        `Error replacing environment selectors for policy ${policy.id}`,
      ),
    );
  policyTargetsComputer
    .resourceSelectors()
    .replace()
    .catch((e) =>
      log.error(
        e,
        `Error replacing resource selectors for policy ${policy.id}`,
      ),
    );

  return updatedPolicy;
};
