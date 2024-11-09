import { z } from "zod";

import type { TargetDeleted, TargetRemoved } from "./target.js";
import { targetDeleted, targetRemoved } from "./target.js";

export * from "./target.js";

export const hookEvent = z.union([targetRemoved, targetDeleted]);
export type HookEvent = z.infer<typeof hookEvent>;

// typeguards
export const isTargetRemoved = (event: HookEvent): event is TargetRemoved =>
  event.action === "removed";
export const isTargetDeleted = (event: HookEvent): event is TargetDeleted =>
  event.action === "deleted";
