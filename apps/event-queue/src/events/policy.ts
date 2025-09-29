import type { Event, FullPolicy } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

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

export const newPolicy: Handler<Event.PolicyCreated> = async (
  event,
  ws,
  span,
) => {
  span.setAttribute("policy.id", event.payload.id);

  const policy = getPolicyWithDates(event.payload);
  await OperationPipeline.update(ws).policy(policy).dispatch();
};

export const updatedPolicy: Handler<Event.PolicyUpdated> = async (
  event,
  ws,
  span,
) => {
  span.setAttribute("policy.id", event.payload.current.id);
  const policy = getPolicyWithDates(event.payload.current);
  await OperationPipeline.update(ws).policy(policy).dispatch();
};

export const deletedPolicy: Handler<Event.PolicyDeleted> = async (
  event,
  ws,
) => {
  await OperationPipeline.delete(ws).policy(event.payload).dispatch();
};
