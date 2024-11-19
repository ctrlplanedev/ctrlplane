import type { HookEvent } from "@ctrlplane/validators/events";

import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";

import { handleResourceRemoved } from "./handlers/index.js";

export * from "./triggers/index.js";
export * from "./handlers/index.js";

export const handleEvent = async (event: HookEvent) => {
  await db.insert(SCHEMA.event).values(event);
  return handleResourceRemoved(event);
};
