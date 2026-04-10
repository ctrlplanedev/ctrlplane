import type { Tx } from "@ctrlplane/db";
import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";

const deleteAllRulesForPolicy = async (tx: Tx, policyId: string) => {
  await tx
    .delete(schema.policyRuleAnyApproval)
    .where(eq(schema.policyRuleAnyApproval.policyId, policyId));
  await tx
    .delete(schema.policyRuleDeploymentDependency)
    .where(eq(schema.policyRuleDeploymentDependency.policyId, policyId));
  await tx
    .delete(schema.policyRuleDeploymentWindow)
    .where(eq(schema.policyRuleDeploymentWindow.policyId, policyId));
  await tx
    .delete(schema.policyRuleEnvironmentProgression)
    .where(eq(schema.policyRuleEnvironmentProgression.policyId, policyId));
  await tx
    .delete(schema.policyRuleGradualRollout)
    .where(eq(schema.policyRuleGradualRollout.policyId, policyId));
  await tx
    .delete(schema.policyRuleRetry)
    .where(eq(schema.policyRuleRetry.policyId, policyId));
  await tx
    .delete(schema.policyRuleRollback)
    .where(eq(schema.policyRuleRollback.policyId, policyId));
  await tx
    .delete(schema.policyRuleVerification)
    .where(eq(schema.policyRuleVerification.policyId, policyId));
  await tx
    .delete(schema.policyRuleVersionCooldown)
    .where(eq(schema.policyRuleVersionCooldown.policyId, policyId));
  await tx
    .delete(schema.policyRuleVersionSelector)
    .where(eq(schema.policyRuleVersionSelector.policyId, policyId));
};


const insertPolicyRules = async (tx: Tx, policyId: string, rules: any[]) => {
  for (const rule of rules) {
    const ruleId: string = rule.id ?? uuidv4();

    if (rule.anyApproval != null)
      await tx.insert(schema.policyRuleAnyApproval).values({
        id: ruleId,
        policyId,
        minApprovals: rule.anyApproval.minApprovals,
      });

    if (rule.deploymentDependency != null)
      await tx.insert(schema.policyRuleDeploymentDependency).values({
        id: ruleId,
        policyId,
        dependsOn: rule.deploymentDependency.dependsOn,
      });

    if (rule.deploymentWindow != null)
      await tx.insert(schema.policyRuleDeploymentWindow).values({
        id: ruleId,
        policyId,
        allowWindow: rule.deploymentWindow.allowWindow,
        durationMinutes: rule.deploymentWindow.durationMinutes,
        rrule: rule.deploymentWindow.rrule,
        timezone: rule.deploymentWindow.timezone,
      });

    if (rule.environmentProgression != null)
      await tx.insert(schema.policyRuleEnvironmentProgression).values({
        id: ruleId,
        policyId,
        dependsOnEnvironmentSelector:
          rule.environmentProgression.dependsOnEnvironmentSelector,
        maximumAgeHours: rule.environmentProgression.maximumAgeHours,
        minimumSoakTimeMinutes:
          rule.environmentProgression.minimumSoakTimeMinutes,
        minimumSuccessPercentage:
          rule.environmentProgression.minimumSuccessPercentage,
        successStatuses: rule.environmentProgression.successStatuses,
      });

    if (rule.gradualRollout != null)
      await tx.insert(schema.policyRuleGradualRollout).values({
        id: ruleId,
        policyId,
        rolloutType: rule.gradualRollout.rolloutType,
        timeScaleInterval: rule.gradualRollout.timeScaleInterval,
      });

    if (rule.retry != null)
      await tx.insert(schema.policyRuleRetry).values({
        id: ruleId,
        policyId,
        maxRetries: rule.retry.maxRetries,
        backoffSeconds: rule.retry.backoffSeconds,
        backoffStrategy: rule.retry.backoffStrategy,
        maxBackoffSeconds: rule.retry.maxBackoffSeconds,
        retryOnStatuses: rule.retry.retryOnStatuses,
      });

    if (rule.verification != null)
      await tx.insert(schema.policyRuleVerification).values({
        id: ruleId,
        policyId,
        metrics: rule.verification.metrics,
        triggerOn: rule.verification.triggerOn,
      });

    if (rule.versionCooldown != null)
      await tx.insert(schema.policyRuleVersionCooldown).values({
        id: ruleId,
        policyId,
        intervalSeconds: rule.versionCooldown.intervalSeconds,
      });

    if (rule.versionSelector != null)
      await tx.insert(schema.policyRuleVersionSelector).values({
        id: ruleId,
        policyId,
        description: rule.versionSelector.description,
        selector: rule.versionSelector.selector,
      });
  }
};

const policyWithRules = {
  anyApprovalRules: true,
  deploymentDependencyRules: true,
  deploymentWindowRules: true,
  environmentProgressionRules: true,
  gradualRolloutRules: true,
  retryRules: true,
  rollbackRules: true,
  verificationRules: true,
  versionCooldownRules: true,
  versionSelectorRules: true,
} as const;

type PolicyRow = NonNullable<
  Awaited<
    ReturnType<
      typeof db.query.policy.findFirst<{ with: typeof policyWithRules }>
    >
  >
>;

const formatPolicyRule = (
  id: string,
  policyId: string,
  createdAt: Date,
  ruleData: Record<string, unknown>,
) => ({
  id,
  policyId,
  createdAt: createdAt.toISOString(),
  ...ruleData,
});

const formatPolicy = (p: PolicyRow) => {
  const rules = [
    ...p.anyApprovalRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        anyApproval: { minApprovals: r.minApprovals },
      }),
    ),
    ...p.deploymentDependencyRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        deploymentDependency: { dependsOn: r.dependsOn },
      }),
    ),
    ...p.deploymentWindowRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        deploymentWindow: {
          allowWindow: r.allowWindow,
          durationMinutes: r.durationMinutes,
          rrule: r.rrule,
          ...(r.timezone != null && { timezone: r.timezone }),
        },
      }),
    ),
    ...p.environmentProgressionRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        environmentProgression: {
          dependsOnEnvironmentSelector: r.dependsOnEnvironmentSelector,
          ...(r.maximumAgeHours != null && {
            maximumAgeHours: r.maximumAgeHours,
          }),
          minimumSoakTimeMinutes: r.minimumSoakTimeMinutes,
          minimumSuccessPercentage: r.minimumSuccessPercentage,
          ...(r.successStatuses != null && {
            successStatuses: r.successStatuses,
          }),
        },
      }),
    ),
    ...p.gradualRolloutRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        gradualRollout: {
          rolloutType: r.rolloutType,
          timeScaleInterval: r.timeScaleInterval,
        },
      }),
    ),
    ...p.retryRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        retry: {
          maxRetries: r.maxRetries,
          ...(r.backoffSeconds != null && {
            backoffSeconds: r.backoffSeconds,
          }),
          ...(r.backoffStrategy != null && {
            backoffStrategy: r.backoffStrategy,
          }),
          ...(r.maxBackoffSeconds != null && {
            maxBackoffSeconds: r.maxBackoffSeconds,
          }),
          ...(r.retryOnStatuses != null && {
            retryOnStatuses: r.retryOnStatuses,
          }),
        },
      }),
    ),
    ...p.rollbackRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        rollback: {
          ...(r.onJobStatuses != null && {
            onJobStatuses: r.onJobStatuses,
          }),
          ...(r.onVerificationFailure != null && {
            onVerificationFailure: r.onVerificationFailure,
          }),
        },
      }),
    ),
    ...p.verificationRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        verification: {
          metrics: r.metrics,
          ...(r.triggerOn != null && { triggerOn: r.triggerOn }),
        },
      }),
    ),
    ...p.versionCooldownRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        versionCooldown: { intervalSeconds: r.intervalSeconds },
      }),
    ),
    ...p.versionSelectorRules.map((r) =>
      formatPolicyRule(r.id, r.policyId, r.createdAt, {
        versionSelector: {
          selector: r.selector,
          ...(r.description != null && { description: r.description }),
        },
      }),
    ),
  ];

  return {
    id: p.id,
    workspaceId: p.workspaceId,
    createdAt: p.createdAt.toISOString(),
    name: p.name,
    ...(p.description != null && { description: p.description }),
    priority: p.priority,
    enabled: p.enabled,
    metadata: p.metadata,
    selector: p.selector,
    rules,
  };
};

const listPolicies: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const [policies, countResult] = await Promise.all([
    db.query.policy.findMany({
      where: eq(schema.policy.workspaceId, workspaceId),
      with: policyWithRules,
      limit,
      offset,
    }),
    db
      .select({ total: count() })
      .from(schema.policy)
      .where(eq(schema.policy.workspaceId, workspaceId)),
  ]);

  const total = countResult[0]?.total ?? 0;

  res
    .status(200)
    .json({ items: policies.map(formatPolicy), total, limit, offset });
};

const deletePolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;

  const [deleted] = await db
    .delete(schema.policy)
    .where(
      and(
        eq(schema.policy.id, policyId),
        eq(schema.policy.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!deleted) throw new ApiError("Policy not found", 404);

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res.status(202).json({
    id: deleted.id,
    workspaceId: deleted.workspaceId,
    createdAt: deleted.createdAt.toISOString(),
    name: deleted.name,
    ...(deleted.description != null && { description: deleted.description }),
    priority: deleted.priority,
    enabled: deleted.enabled,
    metadata: deleted.metadata,
    selector: deleted.selector,
    rules: [],
  });
};

const upsertPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "put"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;
  const { body } = req;

  const policyIdResult = z.string().uuid().safeParse(policyId);
  if (!policyIdResult.success)
    throw new ApiError("Invalid policy ID: must be a valid UUID v4", 400);

  const existing = await db
    .select({ createdAt: schema.policy.createdAt })
    .from(schema.policy)
    .where(eq(schema.policy.id, policyId))
    .limit(1);

  const now = new Date();
  const createdAt = existing[0]?.createdAt ?? now;
  const createdAtStr = createdAt.toISOString();

  const rules = body.rules.map((rule) => ({
    ...rule,
    id: rule.id ?? uuidv4(),
    policyId,
    createdAt: rule.createdAt ?? createdAtStr,
  }));

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.policy)
      .values({
        id: policyId,
        workspaceId,
        name: body.name,
        description: body.description,
        priority: body.priority,
        enabled: body.enabled,
        metadata: body.metadata,
        selector: body.selector,
        createdAt,
      })
      .onConflictDoUpdate({
        target: schema.policy.id,
        set: {
          name: body.name,
          description: body.description,
          priority: body.priority,
          enabled: body.enabled,
          metadata: body.metadata,
          selector: body.selector,
        },
      });

    await deleteAllRulesForPolicy(tx, policyId);
    await insertPolicyRules(tx, policyId, rules);
  });

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res.status(202).json({
    id: policyId,
    workspaceId,
    createdAt: createdAtStr,
    name: body.name,
    description: body.description,
    priority: body.priority,
    enabled: body.enabled,
    metadata: body.metadata,
    selector: body.selector,
    rules,
  });
};

const getPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies/{policyId}",
  "get"
> = async (req, res) => {
  const { workspaceId, policyId } = req.params;

  const row = await db.query.policy.findFirst({
    where: and(
      eq(schema.policy.id, policyId),
      eq(schema.policy.workspaceId, workspaceId),
    ),
    with: policyWithRules,
  });

  if (!row) throw new ApiError("Policy not found", 404);

  res.status(200).json(formatPolicy(row));
};

const createPolicy: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/policies",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const policyId = uuidv4();
  const now = new Date();
  const createdAtStr = now.toISOString();

  const rules = (body.rules ?? []).map((rule) => ({
    ...rule,
    id: uuidv4(),
    policyId,
    createdAt: createdAtStr,
  }));

  await db.transaction(async (tx) => {
    await tx.insert(schema.policy).values({
      id: policyId,
      workspaceId,
      name: body.name,
      description: body.description,
      priority: body.priority ?? 0,
      enabled: body.enabled ?? true,
      metadata: body.metadata ?? {},
      selector: body.selector ?? "true",
      createdAt: now,
    });

    await insertPolicyRules(tx, policyId, rules);
  });

  enqueueAllReleaseTargetsDesiredVersion(db, workspaceId);

  res.status(202).json({
    id: policyId,
    workspaceId,
    createdAt: createdAtStr,
    name: body.name,
    description: body.description,
    priority: body.priority ?? 0,
    enabled: body.enabled ?? true,
    metadata: body.metadata ?? {},
    selector: body.selector ?? "true",
    rules,
  });
};

export const policiesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listPolicies))
  .post("/", asyncHandler(createPolicy))
  .get("/:policyId", asyncHandler(getPolicy))
  .delete("/:policyId", asyncHandler(deletePolicy))
  .put("/:policyId", asyncHandler(upsertPolicy));
