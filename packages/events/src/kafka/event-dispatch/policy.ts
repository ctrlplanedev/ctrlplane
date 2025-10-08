import type { FullPolicy } from "../events.js";
import { sendNodeEvent } from "../client.js";
import { Event } from "../events.js";

export const dispatchPolicyCreated = async (policy: FullPolicy) =>
  sendNodeEvent({
    workspaceId: policy.workspaceId,
    eventType: Event.PolicyCreated,
    eventId: policy.id,
    timestamp: Date.now(),
    source: "api",
    payload: policy,
  });

export const dispatchPolicyUpdated = async (
  previous: FullPolicy,
  current: FullPolicy,
) =>
  sendNodeEvent({
    workspaceId: current.workspaceId,
    eventType: Event.PolicyUpdated,
    eventId: current.id,
    timestamp: Date.now(),
    source: "api",
    payload: { previous, current },
  });

export const dispatchPolicyDeleted = async (policy: FullPolicy) =>
  sendNodeEvent({
    workspaceId: policy.workspaceId,
    eventType: Event.PolicyDeleted,
    eventId: policy.id,
    timestamp: Date.now(),
    source: "api",
    payload: policy,
  });
