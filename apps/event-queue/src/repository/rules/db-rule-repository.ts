import type { Tx } from "@ctrlplane/db";
import type { FullPolicy } from "@ctrlplane/events";
import type {
  FilterRule,
  PreValidationRule,
  Version,
} from "@ctrlplane/rule-engine";

import { allRules, buildConflictUpdateColumns, eq } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  getConcurrencyRule,
  getEnvironmentVersionRolloutRule,
  getVersionApprovalRules,
  getVersionDependencyRule,
  ReleaseTargetConcurrencyRule,
  ReleaseTargetLockRule,
} from "@ctrlplane/rule-engine";

import type { VersionRuleRepository } from "./repository";

export class DbVersionRuleRepository implements VersionRuleRepository {
  private readonly workspaceId: string;
  private db: Tx;
  constructor(workspaceId: string, tx?: Tx) {
    this.workspaceId = workspaceId;
    this.db = tx ?? dbClient;
  }

  private async upsertDeploymentVersionSelector(tx: Tx, policy: FullPolicy) {
    const { deploymentVersionSelector } = policy;
    if (deploymentVersionSelector == null)
      return tx
        .delete(schema.policyRuleDeploymentVersionSelector)
        .where(
          eq(schema.policyRuleDeploymentVersionSelector.policyId, policy.id),
        );

    await tx
      .insert(schema.policyRuleDeploymentVersionSelector)
      .values({ ...deploymentVersionSelector, policyId: policy.id })
      .onConflictDoUpdate({
        target: [schema.policyRuleDeploymentVersionSelector.policyId],
        set: buildConflictUpdateColumns(
          schema.policyRuleDeploymentVersionSelector,
          ["deploymentVersionSelector", "name", "description"],
        ),
      });
  }

  private async removeDeploymentVersionSelector(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleDeploymentVersionSelector)
      .where(eq(schema.policyRuleDeploymentVersionSelector.policyId, policyId));
  }

  private async upsertVersionAnyApprovals(tx: Tx, policy: FullPolicy) {
    const { versionAnyApprovals } = policy;
    if (versionAnyApprovals == null)
      return tx
        .delete(schema.policyRuleAnyApproval)
        .where(eq(schema.policyRuleAnyApproval.policyId, policy.id));

    await tx
      .insert(schema.policyRuleAnyApproval)
      .values({ ...versionAnyApprovals, policyId: policy.id })
      .onConflictDoUpdate({
        target: [schema.policyRuleAnyApproval.policyId],
        set: buildConflictUpdateColumns(schema.policyRuleAnyApproval, [
          "requiredApprovalsCount",
        ]),
      });
  }

  private async removeVersionAnyApprovals(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleAnyApproval)
      .where(eq(schema.policyRuleAnyApproval.policyId, policyId));
  }

  private async upsertVersionUserApprovals(tx: Tx, policy: FullPolicy) {
    const { versionUserApprovals } = policy;

    await tx
      .delete(schema.policyRuleUserApproval)
      .where(eq(schema.policyRuleUserApproval.policyId, policy.id));

    if (versionUserApprovals.length === 0) return;

    await tx
      .insert(schema.policyRuleUserApproval)
      .values(
        versionUserApprovals.map((approval) => ({
          ...approval,
          policyId: policy.id,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.policyRuleUserApproval.policyId],
        set: buildConflictUpdateColumns(schema.policyRuleUserApproval, [
          "userId",
        ]),
      });
  }

  private async removeVersionUserApprovals(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleUserApproval)
      .where(eq(schema.policyRuleUserApproval.policyId, policyId));
  }

  private async upsertVersionRoleApprovals(tx: Tx, policy: FullPolicy) {
    const { versionRoleApprovals } = policy;
    await tx
      .delete(schema.policyRuleRoleApproval)
      .where(eq(schema.policyRuleRoleApproval.policyId, policy.id));

    if (versionRoleApprovals.length === 0) return;

    await tx
      .insert(schema.policyRuleRoleApproval)
      .values(
        versionRoleApprovals.map((approval) => ({
          ...approval,
          policyId: policy.id,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.policyRuleRoleApproval.policyId],
        set: buildConflictUpdateColumns(schema.policyRuleRoleApproval, [
          "roleId",
          "requiredApprovalsCount",
        ]),
      });
  }

  private async removeVersionRoleApprovals(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleRoleApproval)
      .where(eq(schema.policyRuleRoleApproval.policyId, policyId));
  }

  private async upsertConcurrency(tx: Tx, policy: FullPolicy) {
    const { concurrency } = policy;
    if (concurrency == null)
      return tx
        .delete(schema.policyRuleConcurrency)
        .where(eq(schema.policyRuleConcurrency.policyId, policy.id));

    await tx
      .insert(schema.policyRuleConcurrency)
      .values({ ...concurrency, policyId: policy.id })
      .onConflictDoUpdate({
        target: [schema.policyRuleConcurrency.policyId],
        set: buildConflictUpdateColumns(schema.policyRuleConcurrency, [
          "concurrency",
        ]),
      });
  }

  private async removeConcurrency(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleConcurrency)
      .where(eq(schema.policyRuleConcurrency.policyId, policyId));
  }

  private async upsertEnvironmentVersionRollout(tx: Tx, policy: FullPolicy) {
    const { environmentVersionRollout } = policy;
    if (environmentVersionRollout == null)
      return tx
        .delete(schema.policyRuleEnvironmentVersionRollout)
        .where(
          eq(schema.policyRuleEnvironmentVersionRollout.policyId, policy.id),
        );

    await tx
      .insert(schema.policyRuleEnvironmentVersionRollout)
      .values({ ...environmentVersionRollout, policyId: policy.id })
      .onConflictDoUpdate({
        target: [schema.policyRuleEnvironmentVersionRollout.policyId],
        set: buildConflictUpdateColumns(
          schema.policyRuleEnvironmentVersionRollout,
          ["positionGrowthFactor", "timeScaleInterval", "rolloutType"],
        ),
      });
  }

  private async removeEnvironmentVersionRollout(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleEnvironmentVersionRollout)
      .where(eq(schema.policyRuleEnvironmentVersionRollout.policyId, policyId));
  }

  private async upsertMaxRetries(tx: Tx, policy: FullPolicy) {
    const { maxRetries } = policy;
    if (maxRetries == null)
      return tx
        .delete(schema.policyRuleRetry)
        .where(eq(schema.policyRuleRetry.policyId, policy.id));

    await tx
      .insert(schema.policyRuleRetry)
      .values({ ...maxRetries, policyId: policy.id })
      .onConflictDoUpdate({
        target: [schema.policyRuleRetry.policyId],
        set: buildConflictUpdateColumns(schema.policyRuleRetry, ["maxRetries"]),
      });
  }

  private async removeMaxRetries(tx: Tx, policyId: string) {
    await tx
      .delete(schema.policyRuleRetry)
      .where(eq(schema.policyRuleRetry.policyId, policyId));
  }

  async upsertPolicyRules(policy: FullPolicy) {
    await this.db.transaction((tx) =>
      Promise.all([
        this.upsertDeploymentVersionSelector(tx, policy),
        this.upsertVersionAnyApprovals(tx, policy),
        this.upsertVersionUserApprovals(tx, policy),
        this.upsertVersionRoleApprovals(tx, policy),
        this.upsertConcurrency(tx, policy),
        this.upsertEnvironmentVersionRollout(tx, policy),
        this.upsertMaxRetries(tx, policy),
      ]),
    );
  }

  async removePolicyRules(policyId: string) {
    await this.db.transaction((tx) =>
      Promise.all([
        this.removeDeploymentVersionSelector(tx, policyId),
        this.removeVersionAnyApprovals(tx, policyId),
        this.removeVersionUserApprovals(tx, policyId),
        this.removeVersionRoleApprovals(tx, policyId),
        this.removeConcurrency(tx, policyId),
        this.removeEnvironmentVersionRollout(tx, policyId),
        this.removeMaxRetries(tx, policyId),
      ]),
    );
  }

  async getRules(
    policyId: string,
    releaseTargetId: string,
  ): Promise<(FilterRule<Version> | PreValidationRule)[]> {
    const policy =
      (await this.db.query.policy.findFirst({
        where: eq(schema.policy.id, policyId),
        with: allRules,
      })) ?? null;

    const environmentVersionRolloutRule =
      await getEnvironmentVersionRolloutRule(policy, releaseTargetId);
    const versionApprovalRules = await getVersionApprovalRules(
      policy,
      releaseTargetId,
    );
    const versionDependencyRule =
      await getVersionDependencyRule(releaseTargetId);
    const concurrencyRule = getConcurrencyRule(policy);
    const lockRule = new ReleaseTargetLockRule({ releaseTargetId });
    const releaseTargetConcurrencyRule = new ReleaseTargetConcurrencyRule(
      releaseTargetId,
    );

    return [
      ...(environmentVersionRolloutRule ? [environmentVersionRolloutRule] : []),
      ...versionApprovalRules,
      versionDependencyRule,
      ...concurrencyRule,
      lockRule,
      releaseTargetConcurrencyRule,
    ];
  }
}
