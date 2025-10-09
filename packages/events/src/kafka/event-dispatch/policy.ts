import type * as schema from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import type { FullPolicy } from "../events.js";
import * as PB from "../../workspace-engine/types/index.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

const convertFullPolicyToNodeEvent = (policy: FullPolicy) => ({
  workspaceId: policy.workspaceId,
  eventType: Event.PolicyCreated as const,
  eventId: policy.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: policy,
});

const getPbPolicyTarget = (target: schema.PolicyTarget): PB.PolicyTarget => ({
  id: target.id,
  deploymentSelector: PB.wrapSelector(target.deploymentSelector),
  environmentSelector: PB.wrapSelector(target.environmentSelector),
  resourceSelector: PB.wrapSelector(target.resourceSelector),
});

const getAnyApprovalRule = (
  rule: schema.PolicyRuleAnyApproval,
): PB.PolicyRule => ({
  id: rule.id,
  policyId: rule.policyId,
  createdAt: rule.createdAt.toISOString(),
  anyApproval: { minApprovals: rule.requiredApprovalsCount },
});

const getPbPolicy = (policy: FullPolicy): PB.Policy => {
  const selectors = policy.targets.map((target) => getPbPolicyTarget(target));
  const anyApproval = policy.versionAnyApprovals
    ? getAnyApprovalRule(policy.versionAnyApprovals)
    : null;
  const rules = [anyApproval].filter(isPresent);

  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? undefined,
    createdAt: policy.createdAt.toISOString(),
    workspaceId: policy.workspaceId,
    selectors,
    rules,
  };
};

const convertFullPolicyToGoEvent = (policy: FullPolicy) => ({
  workspaceId: policy.workspaceId,
  eventType: Event.PolicyCreated as const,
  data: getPbPolicy(policy),
  timestamp: Date.now(),
});

export const dispatchPolicyCreated = async (policy: FullPolicy) =>
  Promise.all([
    sendNodeEvent(convertFullPolicyToNodeEvent(policy)),
    sendGoEvent(convertFullPolicyToGoEvent(policy)),
  ]);

export const dispatchPolicyUpdated = async (
  previous: FullPolicy,
  current: FullPolicy,
) =>
  Promise.all([
    sendNodeEvent({
      workspaceId: current.workspaceId,
      eventType: Event.PolicyUpdated,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api",
      payload: { previous, current },
    }),
    sendGoEvent(convertFullPolicyToGoEvent(current)),
  ]);

export const dispatchPolicyDeleted = async (policy: FullPolicy) =>
  Promise.all([
    sendNodeEvent({
      workspaceId: policy.workspaceId,
      eventType: Event.PolicyDeleted,
      eventId: policy.id,
      timestamp: Date.now(),
      source: "api",
      payload: policy,
    }),
    sendGoEvent(convertFullPolicyToGoEvent(policy)),
  ]);
