import { sql } from "drizzle-orm";

import type { Tx } from "../common.js";
import type { ReconcileWorkScope } from "../schema/reconcile.js";
import { reconcileWorkScope } from "../schema/reconcile.js";

const scopeConflictTarget = [
  reconcileWorkScope.workspaceId,
  reconcileWorkScope.kind,
  reconcileWorkScope.scopeType,
  reconcileWorkScope.scopeId,
];

interface EnqueueParams {
  workspaceId: string;
  kind: string;
  scopeType?: string;
  scopeId?: string;
  priority?: number;
  notBefore?: Date;
}

export async function enqueue(
  db: Tx,
  params: EnqueueParams,
): Promise<ReconcileWorkScope> {
  const now = new Date();
  const scopeType = params.scopeType ?? "";
  const scopeId = params.scopeId ?? "";
  const priority = params.priority ?? 100;
  const notBefore = params.notBefore ?? now;

  const [scope] = await db
    .insert(reconcileWorkScope)
    .values({
      workspaceId: params.workspaceId,
      kind: params.kind,
      scopeType,
      scopeId,
      priority,
      notBefore,
    })
    .onConflictDoUpdate({
      target: scopeConflictTarget,
      set: {
        eventTs: sql`GREATEST(${reconcileWorkScope.eventTs}, now())`,
        priority: sql`LEAST(${reconcileWorkScope.priority}, ${priority})`,
        notBefore: sql`LEAST(${reconcileWorkScope.notBefore}, ${notBefore})`,
        updatedAt: now,
      },
    })
    .returning();

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

const ENQUEUE_MANY_BATCH_SIZE = 25;

/**
 * Sort by the conflict key so concurrent batch upserts/processes are more likely
 * to touch the same logical rows in a consistent order. This can reduce
 * deadlock risk when multiple transactions operate on overlapping keys, but it
 * does not guarantee lock ordering or eliminate all deadlocks.
 */
function sortByScopeKey<
  T extends {
    workspaceId: string;
    kind: string;
    scopeType: string;
    scopeId: string;
  },
>(values: T[]): T[] {
  return [...values].sort((a, b) => {
    return (
      a.workspaceId.localeCompare(b.workspaceId) ||
      a.kind.localeCompare(b.kind) ||
      a.scopeType.localeCompare(b.scopeType) ||
      a.scopeId.localeCompare(b.scopeId)
    );
  });
}

export async function enqueueMany(
  db: Tx,
  items: EnqueueScopeParams[],
): Promise<void> {
  if (items.length === 0) return;

  const now = new Date();
  const values = sortByScopeKey(
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: item.kind,
      scopeType: item.scopeType ?? "",
      scopeId: item.scopeId ?? "",
      priority: item.priority ?? 100,
      notBefore: item.notBefore ?? now,
    })),
  );

  for (let i = 0; i < values.length; i += ENQUEUE_MANY_BATCH_SIZE) {
    const batch = values.slice(i, i + ENQUEUE_MANY_BATCH_SIZE);
    await db
      .insert(reconcileWorkScope)
      .values(batch)
      .onConflictDoUpdate({
        target: scopeConflictTarget,
        set: {
          eventTs: sql`GREATEST(${reconcileWorkScope.eventTs}, EXCLUDED."event_ts")`,
          priority: sql`LEAST(${reconcileWorkScope.priority}, EXCLUDED."priority")`,
          notBefore: sql`LEAST(${reconcileWorkScope.notBefore}, EXCLUDED."not_before")`,
          updatedAt: now,
        },
      });
  }
}
