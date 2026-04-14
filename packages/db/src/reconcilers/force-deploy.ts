import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue } from "./enqueue.js";

const FORCE_DEPLOY_KIND = "force-deploy";

export async function enqueueForceDeploy(
  db: Tx,
  params: {
    workspaceId: string;
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: FORCE_DEPLOY_KIND,
    scopeType: "release-target",
    scopeId: `${params.deploymentId}:${params.environmentId}:${params.resourceId}`,
  });
}
