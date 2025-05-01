import type { Tx } from "@ctrlplane/db";
import type { z } from "zod";

import { buildConflictUpdateColumns, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

const getLocalDateAsUTC = (date: Date, timeZone: string) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
};

type CreatePolicyInput = z.infer<typeof SCHEMA.createPolicy>;

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
      .values({ ...deploymentVersionSelector, policyId: policy.id })
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
