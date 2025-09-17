import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  selector,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Selector } from "../selector.js";

type DbPolicyTargetReleaseTargetSelectorOptions = {
  workspaceId: string;
  db?: Tx;
};

export class DbPolicyTargetReleaseTargetSelector
  implements Selector<schema.PolicyTarget, schema.ReleaseTarget>
{
  private db: Tx;
  private workspaceId: string;

  constructor(opts: DbPolicyTargetReleaseTargetSelectorOptions) {
    this.db = opts.db ?? dbClient;
    this.workspaceId = opts.workspaceId;
  }

  private async upsertReleaseTarget(releaseTarget: schema.ReleaseTarget) {
    await this.db
      .insert(schema.releaseTarget)
      .values(releaseTarget)
      .onConflictDoNothing();
  }

  private async getPreviouslyMatchedPolicyTargets(
    releaseTarget: schema.ReleaseTarget,
  ) {
    return this.db
      .select()
      .from(schema.computedPolicyTargetReleaseTarget)
      .innerJoin(
        schema.policyTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          schema.policyTarget.id,
        ),
      )
      .where(
        eq(
          schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          releaseTarget.id,
        ),
      )
      .then((rows) => rows.map((row) => row.policy_target));
  }

  private async getMatchablePolicyTargets() {
    return this.db
      .select()
      .from(schema.policyTarget)
      .innerJoin(
        schema.policy,
        eq(schema.policyTarget.policyId, schema.policy.id),
      )
      .where(eq(schema.policy.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.policy_target));
  }

  private async getReleaseTargetMatchesPolicyTarget(
    releaseTarget: schema.ReleaseTarget,
    policyTarget: schema.PolicyTarget,
  ) {
    const { resourceSelector, deploymentSelector, environmentSelector } =
      policyTarget;
    const resourceCheck = selector(this.db)
      .query()
      .resources()
      .where(resourceSelector)
      .sql();

    const deploymentCheck = selector(this.db)
      .query()
      .deployments()
      .where(deploymentSelector)
      .sql();

    const environmentCheck = selector(this.db)
      .query()
      .environments()
      .where(environmentSelector)
      .sql();

    return this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .where(
        and(
          eq(schema.releaseTarget.id, releaseTarget.id),
          resourceCheck,
          deploymentCheck,
          environmentCheck,
        ),
      )
      .then(takeFirstOrNull)
      .then((row) => (isPresent(row) ? policyTarget : null));
  }

  private async getCurrentlyMatchingPolicyTargets(
    releaseTarget: schema.ReleaseTarget,
  ) {
    const wsPolicyTargets = await this.getMatchablePolicyTargets();
    const matchingPolicyTargetsPromise = wsPolicyTargets.map((policyTarget) =>
      this.getReleaseTargetMatchesPolicyTarget(releaseTarget, policyTarget),
    );

    return Promise.all(matchingPolicyTargetsPromise).then((results) =>
      results.filter(isPresent),
    );
  }

  private async removeComputedPolicyTargetReleaseTargetsForEntity(
    entity: schema.ReleaseTarget,
    policyTargetIds: string[],
  ) {
    if (policyTargetIds.length === 0) return;
    await this.db
      .delete(schema.computedPolicyTargetReleaseTarget)
      .where(
        and(
          eq(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            entity.id,
          ),
          inArray(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            policyTargetIds,
          ),
        ),
      );
  }

  private async insertComputedPolicyTargetReleaseTargetsForEntity(
    entity: schema.ReleaseTarget,
    policyTargetIds: string[],
  ) {
    if (policyTargetIds.length === 0) return;
    await this.db.insert(schema.computedPolicyTargetReleaseTarget).values(
      policyTargetIds.map((policyTargetId) => ({
        policyTargetId,
        releaseTargetId: entity.id,
      })),
    );
  }

  async upsertEntity(entity: schema.ReleaseTarget) {
    await this.upsertReleaseTarget(entity);
    const [previouslyMatchedPolicyTargets, currentlyMatchingPolicyTargets] =
      await Promise.all([
        this.getPreviouslyMatchedPolicyTargets(entity),
        this.getCurrentlyMatchingPolicyTargets(entity),
      ]);

    const prevPolicyTargetIds = new Set(
      previouslyMatchedPolicyTargets.map(({ id }) => id),
    );
    const currPolicyTargetIds = new Set(
      currentlyMatchingPolicyTargets.map(({ id }) => id),
    );

    const unmatchedPolicyTargets = previouslyMatchedPolicyTargets.filter(
      (policyTarget) => !currPolicyTargetIds.has(policyTarget.id),
    );
    const newlyMatchedPolicyTargets = currentlyMatchingPolicyTargets.filter(
      (policyTarget) => !prevPolicyTargetIds.has(policyTarget.id),
    );

    await Promise.all([
      this.removeComputedPolicyTargetReleaseTargetsForEntity(
        entity,
        unmatchedPolicyTargets.map(({ id }) => id),
      ),
      this.insertComputedPolicyTargetReleaseTargetsForEntity(
        entity,
        newlyMatchedPolicyTargets.map(({ id }) => id),
      ),
    ]);
  }

  async removeEntity(entity: schema.ReleaseTarget) {
    await this.db
      .delete(schema.releaseTarget)
      .where(eq(schema.releaseTarget.id, entity.id));
  }

  private async upsertPolicyTarget(policyTarget: schema.PolicyTarget) {
    await this.db
      .insert(schema.policyTarget)
      .values(policyTarget)
      .onConflictDoUpdate({
        target: [schema.policyTarget.id],
        set: buildConflictUpdateColumns(schema.policyTarget, [
          "resourceSelector",
          "deploymentSelector",
          "environmentSelector",
        ]),
      });
  }

  private async getPreviouslyMatchedReleaseTargets(
    policyTarget: schema.PolicyTarget,
  ) {
    return this.db
      .select()
      .from(schema.computedPolicyTargetReleaseTarget)
      .innerJoin(
        schema.releaseTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          schema.releaseTarget.id,
        ),
      )
      .where(
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          policyTarget.id,
        ),
      )
      .then((rows) => rows.map((row) => row.release_target));
  }

  private async getCurrentlyMatchingReleaseTargets(
    policyTarget: schema.PolicyTarget,
  ) {
    const { resourceSelector, deploymentSelector, environmentSelector } =
      policyTarget;
    const resourceCheck = selector(this.db)
      .query()
      .resources()
      .where(resourceSelector)
      .sql();

    const deploymentCheck = selector(this.db)
      .query()
      .deployments()
      .where(deploymentSelector)
      .sql();

    const environmentCheck = selector(this.db)
      .query()
      .environments()
      .where(environmentSelector)
      .sql();

    return this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .where(
        and(
          resourceCheck,
          deploymentCheck,
          environmentCheck,
          eq(schema.resource.workspaceId, this.workspaceId),
        ),
      )
      .then((rows) => rows.map((row) => row.release_target));
  }

  private async removeComputedPolicyTargetReleaseTargetsForSelector(
    selector: schema.PolicyTarget,
    releaseTargetIds: string[],
  ) {
    if (releaseTargetIds.length === 0) return;
    await this.db
      .delete(schema.computedPolicyTargetReleaseTarget)
      .where(
        and(
          eq(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            selector.id,
          ),
          inArray(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            releaseTargetIds,
          ),
        ),
      );
  }

  private async insertComputedPolicyTargetReleaseTargetsForSelector(
    selector: schema.PolicyTarget,
    releaseTargetIds: string[],
  ) {
    if (releaseTargetIds.length === 0) return;
    await this.db.insert(schema.computedPolicyTargetReleaseTarget).values(
      releaseTargetIds.map((releaseTargetId) => ({
        policyTargetId: selector.id,
        releaseTargetId,
      })),
    );
  }

  async upsertSelector(selector: schema.PolicyTarget) {
    await this.upsertPolicyTarget(selector);
    const [previouslyMatchedReleaseTargets, currentlyMatchingReleaseTargets] =
      await Promise.all([
        this.getPreviouslyMatchedReleaseTargets(selector),
        this.getCurrentlyMatchingReleaseTargets(selector),
      ]);

    const prevReleaseTargetIds = new Set(
      previouslyMatchedReleaseTargets.map(({ id }) => id),
    );
    const currReleaseTargetIds = new Set(
      currentlyMatchingReleaseTargets.map(({ id }) => id),
    );

    const unmatchedReleaseTargets = previouslyMatchedReleaseTargets.filter(
      (releaseTarget) => !currReleaseTargetIds.has(releaseTarget.id),
    );
    const newlyMatchedReleaseTargets = currentlyMatchingReleaseTargets.filter(
      (releaseTarget) => !prevReleaseTargetIds.has(releaseTarget.id),
    );

    await Promise.all([
      this.removeComputedPolicyTargetReleaseTargetsForSelector(
        selector,
        unmatchedReleaseTargets.map(({ id }) => id),
      ),
      this.insertComputedPolicyTargetReleaseTargetsForSelector(
        selector,
        newlyMatchedReleaseTargets.map(({ id }) => id),
      ),
    ]);
  }

  async removeSelector(selector: schema.PolicyTarget) {
    await this.db
      .delete(schema.policyTarget)
      .where(eq(schema.policyTarget.id, selector.id));
  }

  async getEntitiesForSelector(selector: schema.PolicyTarget) {
    return this.db
      .select()
      .from(schema.computedPolicyTargetReleaseTarget)
      .innerJoin(
        schema.releaseTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.releaseTargetId,
          schema.releaseTarget.id,
        ),
      )
      .where(
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          selector.id,
        ),
      )
      .then((rows) => rows.map((row) => row.release_target));
  }

  async getSelectorsForEntity(entity: schema.ReleaseTarget) {
    return this.db
      .select()
      .from(schema.computedPolicyTargetReleaseTarget)
      .innerJoin(
        schema.policyTarget,
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          schema.policyTarget.id,
        ),
      )
      .where(
        eq(schema.computedPolicyTargetReleaseTarget.releaseTargetId, entity.id),
      )
      .then((rows) => rows.map((row) => row.policy_target));
  }

  async getAllEntities() {
    return this.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.resource,
        eq(schema.releaseTarget.resourceId, schema.resource.id),
      )
      .where(eq(schema.resource.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.release_target));
  }

  async getAllSelectors() {
    return this.db
      .select()
      .from(schema.policyTarget)
      .innerJoin(
        schema.policy,
        eq(schema.policyTarget.policyId, schema.policy.id),
      )
      .where(eq(schema.policy.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.policy_target));
  }

  async isMatch(entity: schema.ReleaseTarget, selector: schema.PolicyTarget) {
    return this.db
      .select()
      .from(schema.computedPolicyTargetReleaseTarget)
      .where(
        and(
          eq(
            schema.computedPolicyTargetReleaseTarget.releaseTargetId,
            entity.id,
          ),
          eq(
            schema.computedPolicyTargetReleaseTarget.policyTargetId,
            selector.id,
          ),
        ),
      )
      .then(takeFirstOrNull)
      .then(isPresent);
  }
}
