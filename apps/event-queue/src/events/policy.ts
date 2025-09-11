import type { Event, FullPolicy } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getPolicyWithDates = (policy: FullPolicy) => {
  const createdAt = new Date(policy.createdAt);
  return { ...policy, createdAt };
};

export const newPolicy: Handler<Event.PolicyCreated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const policy = getPolicyWithDates(event.payload);
  await OperationPipeline.update(ws).policy(policy).dispatch();
};

export const updatedPolicy: Handler<Event.PolicyUpdated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const policy = getPolicyWithDates(event.payload.current);
  await Promise.all(
    event.payload.previous.targets.map((target) =>
      ws.selectorManager.policyTargetReleaseTargetSelector.removeSelector(
        target,
      ),
    ),
  );
  await OperationPipeline.update(ws).policy(policy).dispatch();
};

export const deletedPolicy: Handler<Event.PolicyDeleted> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const policy = getPolicyWithDates(event.payload);
  await OperationPipeline.delete(ws).policy(policy).dispatch();
};
