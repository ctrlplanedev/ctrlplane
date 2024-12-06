import type { HookEvent } from "@ctrlplane/validators/events";

import { handleResourceRemoved } from "./handlers/index.js";

export * from "./triggers/index.js";
export * from "./handlers/index.js";

export const handleEvent = async (event: HookEvent) =>
  handleResourceRemoved(event);
