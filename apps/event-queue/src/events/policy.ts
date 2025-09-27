import type { Event, FullPolicy } from "@ctrlplane/events";

import { makeWithSpan, trace } from "@ctrlplane/logger";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getPolicyWithDates = (policy: FullPolicy) => {
  const createdAt = new Date(policy.createdAt);
  return {
    ...policy,
    createdAt,
    versionAnyApprovals:
      policy.versionAnyApprovals != null
        ? {
            ...policy.versionAnyApprovals,
            createdAt: new Date(policy.versionAnyApprovals.createdAt),
          }
        : null,
    versionUserApprovals: policy.versionUserApprovals.map((approval) => ({
      ...approval,
      createdAt: new Date(approval.createdAt),
    })),
    versionRoleApprovals: policy.versionRoleApprovals.map((approval) => ({
      ...approval,
      createdAt: new Date(approval.createdAt),
    })),
  };
};

const newPolicyTracer = trace.getTracer("new-policy");
const withNewPolicySpan = makeWithSpan(newPolicyTracer);

export const newPolicy: Handler<Event.PolicyCreated> = withNewPolicySpan(
  "new-policy",
  async (span, event) => {
    span.setAttribute("event.type", event.eventType);
    span.setAttribute("policy.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const policy = getPolicyWithDates(event.payload);
    await OperationPipeline.update(ws).policy(policy).dispatch();
  },
);

const updatedPolicyTracer = trace.getTracer("updated-policy");
const withUpdatedPolicySpan = makeWithSpan(updatedPolicyTracer);

export const updatedPolicy: Handler<Event.PolicyUpdated> =
  withUpdatedPolicySpan("updated-policy", async (span, event) => {
    span.setAttribute("event.type", event.eventType);
    span.setAttribute("policy.id", event.payload.current.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    const policy = getPolicyWithDates(event.payload.current);
    await OperationPipeline.update(ws).policy(policy).dispatch();
  });

const deletedPolicyTracer = trace.getTracer("deleted-policy");
const withDeletedPolicySpan = makeWithSpan(deletedPolicyTracer);

export const deletedPolicy: Handler<Event.PolicyDeleted> =
  withDeletedPolicySpan("deleted-policy", async (span, event) => {
    span.setAttribute("event.type", event.eventType);
    span.setAttribute("policy.id", event.payload.id);
    span.setAttribute("workspace.id", event.workspaceId);
    const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
    if (ws == null) return;
    await OperationPipeline.delete(ws).policy(event.payload).dispatch();
  });
