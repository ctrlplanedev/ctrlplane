import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue, enqueueMany } from "./enqueue.js";

const DEPLOYMENT_SELECTOR_EVAL_KIND = "deployment-resource-selector-eval";

export async function enqueueDeploymentSelectorEval(
  db: Tx,
  params: { workspaceId: string; deploymentId: string },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: DEPLOYMENT_SELECTOR_EVAL_KIND,
    scopeType: "deployment",
    scopeId: params.deploymentId,
  });
}

export async function enqueueManyDeploymentSelectorEval(
  db: Tx,
  items: Array<{ workspaceId: string; deploymentId: string }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: DEPLOYMENT_SELECTOR_EVAL_KIND,
      scopeType: "deployment",
      scopeId: item.deploymentId,
    })),
  );
}
