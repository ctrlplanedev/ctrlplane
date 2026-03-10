import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue, enqueueMany } from "./enqueue.js";

const POLICY_EVAL_KIND = "policy-eval";

export async function enqueuePolicyEval(
  db: Tx,
  workspaceId: string,
  versionId: string,
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId,
    kind: POLICY_EVAL_KIND,
    scopeType: "deployment-version",
    scopeId: versionId,
  });
}

export async function enqueueManyPolicyEval(
  db: Tx,
  items: Array<{ workspaceId: string; versionId: string }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: POLICY_EVAL_KIND,
      scopeType: "deployment-version",
      scopeId: item.versionId,
    })),
  );
}
