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

// ---------------------------------------------------------------------------
// Core enqueue
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Deployment resource-selector eval
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Environment resource-selector eval
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Relationship eval
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Desired release
// ---------------------------------------------------------------------------

const DESIRED_RELEASE_KIND = "desired-release";

export async function enqueueDesiredRelease(
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
    kind: DESIRED_RELEASE_KIND,
    scopeType: "release-target",
    scopeId: `${params.deploymentId}:${params.environmentId}:${params.resourceId}`,
  });
}

export async function enqueueManyDesiredRelease(
  db: Tx,
  items: Array<{
    workspaceId: string;
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  }>,
): Promise<void> {
  return enqueueMany(
    db,
    items.map((item) => ({
      workspaceId: item.workspaceId,
      kind: DESIRED_RELEASE_KIND,
      scopeType: "release-target",
      scopeId: `${item.deploymentId}:${item.environmentId}:${item.resourceId}`,
    })),
  );
}
