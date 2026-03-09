import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import {
  reconcileWorkPayload,
  reconcileWorkScope,
} from "../schema/reconcile.js";

const scopeConflictTarget = [
  reconcileWorkScope.workspaceId,
  reconcileWorkScope.kind,
  reconcileWorkScope.scopeType,
  reconcileWorkScope.scopeId,
];

const payloadConflictTarget = [
  reconcileWorkPayload.scopeRef,
  reconcileWorkPayload.payloadType,
  reconcileWorkPayload.payloadKey,
];

interface EnqueuePayload {
  payloadType?: string;
  payloadKey?: string;
  payload?: Record<string, any>;
}

interface EnqueueParams {
  workspaceId: string;
  kind: string;
  scopeType?: string;
  scopeId?: string;
  priority?: number;
  notBefore?: Date;
  payload?: EnqueuePayload;
}

export async function enqueue(
  db: Tx,
  params: EnqueueParams,
): Promise<ReconcileWorkScope> {
  const now = new Date();
  const [scope] = await db
    .insert(reconcileWorkScope)
    .values({
      workspaceId: params.workspaceId,
      kind: params.kind,
      scopeType: params.scopeType ?? "",
      scopeId: params.scopeId ?? "",
      priority: params.priority ?? 100,
      notBefore: params.notBefore ?? now,
    })
    .onConflictDoUpdate({
      target: scopeConflictTarget,
      set: {
        eventTs: now,
        priority: params.priority ?? 100,
        notBefore: params.notBefore ?? now,
      },
    })
    .returning();

  if (params.payload && scope) {
    await db
      .insert(reconcileWorkPayload)
      .values({
        scopeRef: scope.id,
        payloadType: params.payload.payloadType ?? "",
        payloadKey: params.payload.payloadKey ?? "",
        payload: params.payload.payload ?? {},
      })
      .onConflictDoUpdate({
        target: payloadConflictTarget,
        set: { payload: params.payload.payload ?? {} },
      });
  }

  return scope!;
}

interface EnqueueScopeParams {
  workspaceId: string;
  kind: string;
  scopeType?: string;
  scopeId?: string;
  priority?: number;
  notBefore?: Date;
}

export async function enqueueMany(
  db: Tx,
  items: EnqueueScopeParams[],
): Promise<void> {
  if (items.length === 0) return;

  const now = new Date();
  const values = items.map((item) => ({
    workspaceId: item.workspaceId,
    kind: item.kind,
    scopeType: item.scopeType ?? "",
    scopeId: item.scopeId ?? "",
    priority: item.priority ?? 100,
    notBefore: item.notBefore ?? now,
  }));

  await db
    .insert(reconcileWorkScope)
    .values(values)
    .onConflictDoUpdate({
      target: scopeConflictTarget,
      set: { eventTs: now, notBefore: now },
    });
}
