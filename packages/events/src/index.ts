import type { HookEvent } from "@ctrlplane/validators/events";

import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { isTargetRemoved } from "@ctrlplane/validators/events";

import { handleTargetRemoved } from "./handlers/target-removed.js";

export * from "./triggers/index.js";
export * from "./handlers/index.js";

export const handleEvent = async (event: HookEvent) => {
  await db.insert(SCHEMA.event).values(event);
  if (isTargetRemoved(event)) return handleTargetRemoved(event);
  throw new Error(`Unhandled event: ${event.event}`);
};
