import type { FullReleaseTarget } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Selector } from "../selector.js";
import { deploymentMatchesSelector } from "./deployment-match.js";
import { environmentMatchesSelector } from "./environment-match.js";
import { resourceMatchesSelector } from "./resource-match.js";

const log = logger.child({
  module: "in-memory-policy-target-release-target-selector",
});

export const entityMatchesSelector = (
  entity: FullReleaseTarget,
  selector: schema.PolicyTarget,
) => {
  const { resourceSelector, deploymentSelector, environmentSelector } =
    selector;
  if (
    resourceSelector == null &&
    deploymentSelector == null &&
    environmentSelector == null
  )
    return false;
  const { resource, environment, deployment } = entity;
  const resourceMatch =
    resourceSelector == null ||
    resourceMatchesSelector(resource, resourceSelector);
  const deploymentMatch =
    deploymentSelector == null ||
    deploymentMatchesSelector(deployment, deploymentSelector);
  const environmentMatch =
    environmentSelector == null ||
    environmentMatchesSelector(environment, environmentSelector);
  return resourceMatch && deploymentMatch && environmentMatch;
};

const getAllEntities = async (workspaceId: string) => {
  const dbResult = await dbClient
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .leftJoin(
      schema.resourceMetadata,
      eq(schema.resource.id, schema.resourceMetadata.resourceId),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.resource.workspaceId, workspaceId));

  return _.chain(dbResult)
    .groupBy((row) => row.release_target.id)
    .map((group) => {
      const [first] = group;
      if (first == null) return null;
      const { release_target, resource, environment, deployment } = first;
      const resourceMetadata = Object.fromEntries(
        group
          .map((r) => r.resource_metadata)
          .filter(isPresent)
          .map((m) => [m.key, m.value]),
      );
      return {
        ...release_target,
        resource: { ...resource, metadata: resourceMetadata },
        environment,
        deployment,
      };
    })
    .value()
    .filter(isPresent);
};

const getAllSelectors = async (workspaceId: string) =>
  dbClient
    .select()
    .from(schema.policyTarget)
    .innerJoin(
      schema.policy,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .where(eq(schema.policy.workspaceId, workspaceId))
    .then((results) => results.map((result) => result.policy_target));

type InMemoryPolicyTargetReleaseTargetSelectorOptions = {
  initialEntities: FullReleaseTarget[];
  initialSelectors: schema.PolicyTarget[];
};

export class InMemoryPolicyTargetReleaseTargetSelector
  implements Selector<schema.PolicyTarget, FullReleaseTarget>
{
  private entities: Map<string, FullReleaseTarget>;
  private selectors: Map<string, schema.PolicyTarget>;
  private matches: Map<string, Set<string>>; // releaseTargetId -> policyTargetId

  constructor(opts: InMemoryPolicyTargetReleaseTargetSelectorOptions) {
    this.entities = new Map(
      opts.initialEntities.map((entity) => [entity.id, entity]),
    );
    this.selectors = new Map(
      opts.initialSelectors.map((selector) => [selector.id, selector]),
    );
    this.matches = new Map();

    for (const entity of opts.initialEntities) {
      this.matches.set(entity.id, new Set());

      for (const selector of opts.initialSelectors) {
        const match = entityMatchesSelector(entity, selector);
        if (match) this.matches.get(entity.id)?.add(selector.id);
      }
    }
  }

  get selectorMatches() {
    return this.matches;
  }

  static async create(workspaceId: string) {
    const [allEntities, allSelectors] = await Promise.all([
      getAllEntities(workspaceId),
      getAllSelectors(workspaceId),
    ]);
    const inMemoryPolicyTargetReleaseTargetSelector =
      new InMemoryPolicyTargetReleaseTargetSelector({
        initialEntities: allEntities,
        initialSelectors: allSelectors,
      });

    const matches = inMemoryPolicyTargetReleaseTargetSelector.selectorMatches;

    const computed: { releaseTargetId: string; policyTargetId: string }[] = [];
    for (const [releaseTargetId, policyTargetIds] of matches)
      for (const policyTargetId of policyTargetIds)
        computed.push({ releaseTargetId, policyTargetId });

    log.info(
      `Inserting ${computed.length} initial computed policy target release targets`,
    );
    if (computed.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < computed.length; i += batchSize) {
        const batch = computed.slice(i, i + batchSize);
        if (batch.length > 0)
          await dbClient
            .insert(schema.computedPolicyTargetReleaseTarget)
            .values(batch)
            .onConflictDoNothing();
      }
    }

    return inMemoryPolicyTargetReleaseTargetSelector;
  }

  upsertEntity(entity: FullReleaseTarget): void {
    if (this.matches.get(entity.id) == null)
      this.matches.set(entity.id, new Set());
    this.entities.set(entity.id, entity);

    const previouslyMatchingSelectors =
      this.matches.get(entity.id) ?? new Set();
    const currentlyMatchingSelectors = new Set<string>();

    for (const selector of this.selectors.values())
      if (entityMatchesSelector(entity, selector))
        currentlyMatchingSelectors.add(selector.id);

    const unmatchedSelectors = Array.from(previouslyMatchingSelectors).filter(
      (selectorId) => !currentlyMatchingSelectors.has(selectorId),
    );

    const newlyMatchedSelectors = Array.from(currentlyMatchingSelectors).filter(
      (selectorId) => !previouslyMatchingSelectors.has(selectorId),
    );

    for (const selectorId of unmatchedSelectors)
      this.matches.get(entity.id)?.delete(selectorId);

    for (const selectorId of newlyMatchedSelectors)
      this.matches.get(entity.id)?.add(selectorId);

    if (unmatchedSelectors.length > 0)
      dbClient
        .delete(schema.computedPolicyTargetReleaseTarget)
        .where(
          and(
            eq(
              schema.computedPolicyTargetReleaseTarget.releaseTargetId,
              entity.id,
            ),
            inArray(
              schema.computedPolicyTargetReleaseTarget.policyTargetId,
              unmatchedSelectors,
            ),
          ),
        )
        .catch((error) => {
          log.error("Error deleting computed policy target release targets", {
            error,
            entityId: entity.id,
            unmatchedSelectors,
          });
        });

    if (newlyMatchedSelectors.length > 0)
      dbClient
        .insert(schema.computedPolicyTargetReleaseTarget)
        .values(
          newlyMatchedSelectors.map((selectorId) => ({
            releaseTargetId: entity.id,
            policyTargetId: selectorId,
          })),
        )
        .onConflictDoNothing()
        .catch((error) => {
          log.error("Error inserting computed policy target release targets", {
            error,
            entityId: entity.id,
            newlyMatchedSelectors,
          });
        });
  }
  removeEntity(entity: FullReleaseTarget): void {
    this.entities.delete(entity.id);
    this.matches.delete(entity.id);
    dbClient
      .delete(schema.computedPolicyTargetReleaseTarget)
      .where(
        eq(schema.computedPolicyTargetReleaseTarget.releaseTargetId, entity.id),
      )
      .catch((error) => {
        log.error("Error deleting computed policy target release targets", {
          error,
          entityId: entity.id,
        });
      });
  }
  upsertSelector(selector: schema.PolicyTarget): void {
    this.selectors.set(selector.id, selector);

    const previouslyMatchingEntities = Array.from(this.matches.entries())
      .filter(([, selectorIds]) => selectorIds.has(selector.id))
      .map(([entityId]) => entityId);
    const currentlyMatchingEntities = Array.from(this.entities.values())
      .filter((entity) => entityMatchesSelector(entity, selector))
      .map((entity) => entity.id);

    const unmatchedEntities = previouslyMatchingEntities.filter(
      (entityId) => !currentlyMatchingEntities.includes(entityId),
    );
    const newlyMatchedEntities = currentlyMatchingEntities.filter(
      (entityId) => !previouslyMatchingEntities.includes(entityId),
    );

    for (const entityId of unmatchedEntities)
      this.matches.get(entityId)?.delete(selector.id);

    for (const entityId of newlyMatchedEntities)
      this.matches.get(entityId)?.add(selector.id);

    if (unmatchedEntities.length > 0)
      dbClient
        .delete(schema.computedPolicyTargetReleaseTarget)
        .where(
          and(
            eq(
              schema.computedPolicyTargetReleaseTarget.policyTargetId,
              selector.id,
            ),
            inArray(
              schema.computedPolicyTargetReleaseTarget.releaseTargetId,
              unmatchedEntities,
            ),
          ),
        )
        .catch((error) => {
          log.error("Error deleting computed policy target release targets", {
            error,
            selectorId: selector.id,
            unmatchedEntities,
          });
        });

    if (newlyMatchedEntities.length > 0)
      dbClient
        .insert(schema.computedPolicyTargetReleaseTarget)
        .values(
          newlyMatchedEntities.map((entityId) => ({
            releaseTargetId: entityId,
            policyTargetId: selector.id,
          })),
        )
        .onConflictDoNothing()
        .catch((error) => {
          log.error("Error inserting computed policy target release targets", {
            error,
            selectorId: selector.id,
            newlyMatchedEntities,
          });
        });
  }
  removeSelector(selector: schema.PolicyTarget): void {
    this.selectors.delete(selector.id);

    for (const selectorIds of this.matches.values())
      if (selectorIds.has(selector.id)) selectorIds.delete(selector.id);

    dbClient
      .delete(schema.computedPolicyTargetReleaseTarget)
      .where(
        eq(
          schema.computedPolicyTargetReleaseTarget.policyTargetId,
          selector.id,
        ),
      )
      .catch((error) => {
        log.error("Error deleting computed policy target release targets", {
          error,
          selectorId: selector.id,
        });
      });
  }

  getEntitiesForSelector(selector: schema.PolicyTarget): FullReleaseTarget[] {
    return Array.from(this.matches.entries())
      .filter(([, selectorIds]) => selectorIds.has(selector.id))
      .map(([entityId]) => this.entities.get(entityId))
      .filter(isPresent);
  }
  getSelectorsForEntity(entity: FullReleaseTarget): schema.PolicyTarget[] {
    return Array.from(this.matches.get(entity.id) ?? new Set<string>())
      .map((selectorId) => this.selectors.get(selectorId))
      .filter(isPresent);
  }
  getAllEntities(): FullReleaseTarget[] {
    return Array.from(this.entities.values());
  }
  getAllSelectors(): schema.PolicyTarget[] {
    return Array.from(this.selectors.values());
  }
  isMatch(entity: FullReleaseTarget, selector: schema.PolicyTarget): boolean {
    return this.matches.get(entity.id)?.has(selector.id) ?? false;
  }
}
