import type { EventPayload } from "@ctrlplane/events";

import { Event } from "@ctrlplane/events";

import type { WorkspaceStore } from "../workspace-store/workspace-store";
import { handleResourceCreated } from "./resources.js";

export const eventHandlers: {
  [K in keyof EventPayload]: (
    workspaceStore: WorkspaceStore,
    event: EventPayload[K],
  ) => Promise<void>;
} = {
  [Event.ResourceCreated]: handleResourceCreated,
  [Event.ResourceUpdated]: (_, __) => Promise.resolve(),
  [Event.ResourceDeleted]: (_, __) => Promise.resolve(),
  [Event.DeploymentCreated]: (_, __) => Promise.resolve(),
  [Event.DeploymentUpdated]: (_, __) => Promise.resolve(),
  [Event.DeploymentDeleted]: (_, __) => Promise.resolve(),
  [Event.EnvironmentCreated]: (_, __) => Promise.resolve(),
  [Event.EnvironmentUpdated]: (_, __) => Promise.resolve(),
  [Event.EnvironmentDeleted]: (_, __) => Promise.resolve(),
  [Event.PolicyCreated]: (_, __) => Promise.resolve(),
  [Event.PolicyUpdated]: (_, __) => Promise.resolve(),
  [Event.PolicyDeleted]: (_, __) => Promise.resolve(),
  [Event.JobCreated]: (_, __) => Promise.resolve(),
  [Event.JobUpdated]: (_, __) => Promise.resolve(),
  [Event.JobDeleted]: (_, __) => Promise.resolve(),
  [Event.SystemCreated]: (_, __) => Promise.resolve(),
  [Event.SystemUpdated]: (_, __) => Promise.resolve(),
  [Event.SystemDeleted]: (_, __) => Promise.resolve(),
  [Event.ReleaseCreated]: (_, __) => Promise.resolve(),
  [Event.ReleaseUpdated]: (_, __) => Promise.resolve(),
  [Event.ReleaseDeleted]: (_, __) => Promise.resolve(),
};
