import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { WorkspaceManager } from "../workspace/workspace.js";

export const newResource: Handler<Event.ResourceCreated> = async (event) => {
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  console.log(ws);
};

export const updatedResource: Handler<Event.ResourceUpdated> = (event) => {
  console.log(event);
};

export const deletedResource: Handler<Event.ResourceDeleted> = (event) => {
  console.log(event);
};
