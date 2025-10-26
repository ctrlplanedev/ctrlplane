import type * as schema from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { isPresent } from "ts-is-present";

import type { FullPolicy, GoEventPayload, GoMessage } from "../events.js";
import { createSpanWrapper } from "../../span.js";
import { sendGoEvent, sendNodeEvent } from "../client.js";
import { Event } from "../events.js";
import { convertToOapiSelector } from "./util.js";

const getOapiPolicyTarget = (
  target: schema.PolicyTarget,
): WorkspaceEngine["schemas"]["PolicyTargetSelector"] => ({
  id: target.id,
  deploymentSelector: convertToOapiSelector(target.deploymentSelector),
  environmentSelector: convertToOapiSelector(target.environmentSelector),
  resourceSelector: convertToOapiSelector(target.resourceSelector),
});

const getAnyApprovalRule = (
  rule: schema.PolicyRuleAnyApproval,
): WorkspaceEngine["schemas"]["PolicyRule"] => ({
  id: rule.id,
  policyId: rule.policyId,
  createdAt: rule.createdAt.toISOString(),
  anyApproval: { minApprovals: rule.requiredApprovalsCount },
});

const getOapiPolicy = (
  policy: FullPolicy,
): WorkspaceEngine["schemas"]["Policy"] => {
  const selectors = policy.targets.map((target) => getOapiPolicyTarget(target));
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
    enabled: policy.enabled,
    priority: policy.priority,
    metadata: {},
  };
};

const convertFullPolicyToGoEvent = (
  policy: FullPolicy,
  eventType: keyof GoEventPayload,
): GoMessage<keyof GoEventPayload> => ({
  workspaceId: policy.workspaceId,
  eventType,
  data: getOapiPolicy(policy),
  timestamp: Date.now(),
});

export const dispatchPolicyCreated = createSpanWrapper(
  "dispatchPolicyCreated",
  async (span: Span, policy: FullPolicy) => {
    span.setAttribute("policy.id", policy.id);
    span.setAttribute("policy.name", policy.name);
    span.setAttribute("workspace.id", policy.workspaceId);

    const eventType = Event.PolicyCreated;
    await sendNodeEvent({
      workspaceId: policy.workspaceId,
      eventType: Event.PolicyCreated,
      eventId: policy.id,
      timestamp: Date.now(),
      source: "api",
      payload: policy,
    });
    await sendGoEvent(
      convertFullPolicyToGoEvent(policy, eventType as keyof GoEventPayload),
    );
  },
);

export const dispatchPolicyUpdated = createSpanWrapper(
  "dispatchPolicyUpdated",
  async (span: Span, previous: FullPolicy, current: FullPolicy) => {
    span.setAttribute("policy.id", current.id);
    span.setAttribute("policy.name", current.name);
    span.setAttribute("workspace.id", current.workspaceId);

    const eventType = Event.PolicyUpdated;
    await sendNodeEvent({
      workspaceId: current.workspaceId,
      eventType,
      eventId: current.id,
      timestamp: Date.now(),
      source: "api",
      payload: { previous, current },
    });
    await sendGoEvent(
      convertFullPolicyToGoEvent(current, eventType as keyof GoEventPayload),
    );
  },
);

export const dispatchPolicyDeleted = createSpanWrapper(
  "dispatchPolicyDeleted",
  async (span: Span, policy: FullPolicy) => {
    span.setAttribute("policy.id", policy.id);
    span.setAttribute("policy.name", policy.name);
    span.setAttribute("workspace.id", policy.workspaceId);

    const eventType = Event.PolicyDeleted;
    await sendNodeEvent({
      workspaceId: policy.workspaceId,
      eventType,
      eventId: policy.id,
      timestamp: Date.now(),
      source: "api",
      payload: policy,
    });
    await sendGoEvent(
      convertFullPolicyToGoEvent(policy, eventType as keyof GoEventPayload),
    );
  },
);
