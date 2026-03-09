import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";

import { enqueue, enqueueMany } from "./enqueue.js";

const POLICY_SUMMARY_KIND = "policy-summary";

export async function enqueuePolicySummary(
  db: Tx,
  params: { workspaceId: string; environmentId: string; versionId: string },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: POLICY_SUMMARY_KIND,
    scopeType: "environment-version",
    scopeId: `${params.environmentId}:${params.versionId}`,
  });
}

export async function enqueueManyPolicySummary(
  db: Tx,
  items: Array<{
    workspaceId: string;
    environmentId: string;
    versionId: string;
  }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: POLICY_SUMMARY_KIND,
      scopeType: "environment-version",
      scopeId: `${item.environmentId}:${item.versionId}`,
    })),
  );
}
