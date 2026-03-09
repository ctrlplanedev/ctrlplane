import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { enqueue, enqueueMany } from "./enqueue.js";

const RELATIONSHIP_EVAL_KIND = "relationship-eval";

type EntityType = "resource" | "deployment" | "environment";

export async function enqueueRelationshipEval(
  db: Tx,
  params: { workspaceId: string; entityType: EntityType; entityId: string },
): Promise<ReconcileWorkScope> {
  return enqueue(db, {
    workspaceId: params.workspaceId,
    kind: RELATIONSHIP_EVAL_KIND,
    scopeType: "entity",
    scopeId: `${params.entityType}:${params.entityId}`,
  });
}

export async function enqueueManyRelationshipEval(
  db: Tx,
  items: Array<{
    workspaceId: string;
    entityType: EntityType;
    entityId: string;
  }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: RELATIONSHIP_EVAL_KIND,
      scopeType: "entity",
      scopeId: `${item.entityType}:${item.entityId}`,
    })),
  );
}
