import type * as schema from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import type {
  FullPolicy,
  PbPolicy,
  PbPolicyRule,
  PbPolicyTarget,
} from "../events.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event, wrapSelector } from "../events.js";

const convertFullPolicyToNodeEvent = (policy: FullPolicy) => ({
  workspaceId: policy.workspaceId,
  eventType: Event.PolicyCreated as const,
  eventId: policy.id,
  timestamp: Date.now(),
  source: "api" as const,
  payload: policy,
});

const getPbPolicyTarget = (target: schema.PolicyTarget): PbPolicyTarget => ({
  id: target.id,
  deploymentSelector: wrapSelector(target.deploymentSelector),
  environmentSelector: wrapSelector(target.environmentSelector),
  resourceSelector: wrapSelector(target.resourceSelector),
});

const getAnyApprovalRule = (
  rule: schema.PolicyRuleAnyApproval,
): PbPolicyRule => ({
  id: rule.id,
  policyId: rule.policyId,
  createdAt: rule.createdAt.toISOString(),
  anyApproval: { minApprovals: rule.requiredApprovalsCount },
});

const getPbPolicy = (policy: FullPolicy): PbPolicy => {
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
