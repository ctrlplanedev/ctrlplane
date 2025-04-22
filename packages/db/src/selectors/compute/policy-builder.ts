import { and, eq, inArray } from "drizzle-orm/pg-core/expressions";

import type { Tx } from "../../common.js";
import * as SCHEMA from "../../schema/index.js";
import { QueryBuilder } from "../query/builder.js";
import { SelectorComputeType, withMutex } from "./mutex.js";

export class PolicyBuilder {
  private targets: SCHEMA.PolicyTarget[];
  constructor(
    private readonly tx: Tx,
    private readonly ids: string[],
  ) {
    this.targets = [];
  }

  private async getTargets(tx: Tx) {
    this.targets = await tx
      .select()
      .from(SCHEMA.policyTarget)
      .where(inArray(SCHEMA.policyTarget.policyId, this.ids));
  }

  private async deleteExistingComputedReleaseTargets(tx: Tx) {
    await tx.delete(SCHEMA.computedPolicyTargetReleaseTarget).where(
      inArray(
        SCHEMA.computedPolicyTargetReleaseTarget.policyTargetId,
        this.targets.map((t) => t.id),
      ),
    );
  }

  private async findMatchingReleaseTargetsForTargets(tx: Tx) {
    const qb = new QueryBuilder(tx);
    const targetPromises = this.targets.map(async (t) => {
      if (
        t.resourceSelector == null &&
        t.deploymentSelector == null &&
        t.environmentSelector == null
      )
        return [];
      const releaseTargets = await tx
        .select()
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
        )
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
        )
        .where(
          and(
            qb.resources().where(t.resourceSelector).sql(),
            qb.deployments().where(t.deploymentSelector).sql(),
            qb.environments().where(t.environmentSelector).sql(),
          ),
        );

      return releaseTargets.map((rt) => ({
        policyTargetId: t.id,
        releaseTargetId: rt.release_target.id,
      }));
    });

    const fulfilled = await Promise.all(targetPromises);
    return fulfilled.flat();
  }

  async releaseTargetSelectors() {
    const policies = await this.tx
      .select()
      .from(SCHEMA.policy)
      .innerJoin(
        SCHEMA.policyTarget,
        eq(SCHEMA.policy.id, SCHEMA.policyTarget.policyId),
      )
      .where(inArray(SCHEMA.policyTarget.id, this.ids));
    if (policies.length === 0) return [];

    const workspaceIds = new Set(policies.map((p) => p.policy.workspaceId));

    if (workspaceIds.size !== 1)
      throw new Error("All policies must be in the same workspace");
    const workspaceId = Array.from(workspaceIds)[0]!;

    return withMutex(SelectorComputeType.PolicyBuilder, workspaceId, () =>
      this.tx.transaction(async (tx) => {
        await this.getTargets(tx);
        await this.deleteExistingComputedReleaseTargets(tx);

        const computedPolicyTargetReleaseTargetInserts =
          await this.findMatchingReleaseTargetsForTargets(tx);
        if (computedPolicyTargetReleaseTargetInserts.length === 0) return [];

        await tx
          .insert(SCHEMA.computedPolicyTargetReleaseTarget)
          .values(computedPolicyTargetReleaseTargetInserts)
          .onConflictDoNothing();
      }),
    );
  }
}

export class WorkspacePolicyBuilder {
  constructor(
    private readonly tx: Tx,
    private readonly workspaceId: string,
  ) {}

  private async getTargets(tx: Tx) {
    return tx
      .select()
      .from(SCHEMA.policyTarget)
      .innerJoin(
        SCHEMA.policy,
        eq(SCHEMA.policyTarget.policyId, SCHEMA.policy.id),
      )
      .where(eq(SCHEMA.policy.workspaceId, this.workspaceId))
      .then((rows) => rows.map((r) => r.policy_target));
  }

  private async deleteExistingComputedReleaseTargets(
    tx: Tx,
    targets: SCHEMA.PolicyTarget[],
  ) {
    await tx.delete(SCHEMA.computedPolicyTargetReleaseTarget).where(
      inArray(
        SCHEMA.computedPolicyTargetReleaseTarget.policyTargetId,
        targets.map((t) => t.id),
      ),
    );
  }

  private async findMatchingReleaseTargetsForTargets(
    tx: Tx,
    targets: SCHEMA.PolicyTarget[],
  ) {
    const qb = new QueryBuilder(tx);
    const targetPromises = targets.map(async (t) => {
      const releaseTargets = await tx
        .select()
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
        )
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
        )
        .where(
          and(
            qb.resources().where(t.resourceSelector).sql(),
            qb.deployments().where(t.deploymentSelector).sql(),
            qb.environments().where(t.environmentSelector).sql(),
          ),
        );

      return releaseTargets.map((rt) => ({
        policyTargetId: t.id,
        releaseTargetId: rt.release_target.id,
      }));
    });

    const fulfilled = await Promise.all(targetPromises);
    return fulfilled.flat();
  }

  async releaseTargetSelectors() {
    return withMutex(SelectorComputeType.PolicyBuilder, this.workspaceId, () =>
      this.tx.transaction(async (tx) => {
        const targets = await this.getTargets(tx);

        await this.deleteExistingComputedReleaseTargets(tx, targets);

        const computedPolicyTargetReleaseTargetInserts =
          await this.findMatchingReleaseTargetsForTargets(tx, targets);
        if (computedPolicyTargetReleaseTargetInserts.length === 0) return [];

        return tx
          .insert(SCHEMA.computedPolicyTargetReleaseTarget)
          .values(computedPolicyTargetReleaseTargetInserts)
          .onConflictDoNothing()
          .returning();
      }),
    );
  }
}
