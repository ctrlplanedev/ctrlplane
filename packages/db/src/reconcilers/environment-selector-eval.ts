import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue, enqueueMany } from "./enqueue.js";

const ENVIRONMENT_SELECTOR_EVAL_KIND = "environment-resource-selector-eval";

export async function enqueueEnvironmentSelectorEval(
  db: Tx,
  params: { workspaceId: string; environmentId: string },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: ENVIRONMENT_SELECTOR_EVAL_KIND,
    scopeType: "environment",
    scopeId: params.environmentId,
  });
}

export async function enqueueManyEnvironmentSelectorEval(
  db: Tx,
  items: Array<{ workspaceId: string; environmentId: string }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: ENVIRONMENT_SELECTOR_EVAL_KIND,
      scopeType: "environment",
      scopeId: item.environmentId,
    })),
  );
}
