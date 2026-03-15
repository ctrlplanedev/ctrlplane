import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue } from "./enqueue.js";

const DEPLOYMENT_PLAN_KIND = "deployment-plan";

export async function enqueueDeploymentPlan(
  db: Tx,
  workspaceId: string,
  planId: string,
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId,
    kind: DEPLOYMENT_PLAN_KIND,
    scopeType: "deployment-plan",
    scopeId: planId,
  });
}
