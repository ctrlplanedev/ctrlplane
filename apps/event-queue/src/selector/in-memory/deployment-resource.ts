import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Selector } from "../selector.js";
import { Trace } from "../../traces.js";
import { resourceMatchesSelector } from "./resource-match.js";

const log = logger.child({
  module: "in-memory-deployment-resource-selector",
});

type InMemoryDeploymentResourceSelectorOptions = {
  initialEntities: FullResource[];
  initialSelectors: schema.Deployment[];
};

const entityMatchesSelector = (
  entity: FullResource,
  selector: schema.Deployment,
) => {
  if (selector.resourceSelector == null) return false;
  return resourceMatchesSelector(entity, selector.resourceSelector);
};

export class InMemoryDeploymentResourceSelector
  implements Selector<schema.Deployment, FullResource>
{
  private entities: Map<string, FullResource>;
  private selectors: Map<string, schema.Deployment>;
  private matches: Map<string, Set<string>>; // resourceId -> deploymentId

  constructor(opts: InMemoryDeploymentResourceSelectorOptions) {
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
        const match =
          selector.resourceSelector != null &&
          resourceMatchesSelector(entity, selector.resourceSelector);
        if (match) this.matches.get(entity.id)?.add(selector.id);
      }
    }
  }

  get selectorMatches() {
    return this.matches;
  }

  @Trace("deployment-resource-selector-create")
  static async create(workspaceId: string, initialEntities: FullResource[]) {
    const allSelectors = await dbClient
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((results) => results.map((result) => result.deployment));

    const inMemoryDeploymentResourceSelector =
      new InMemoryDeploymentResourceSelector({
        initialEntities,
        initialSelectors: allSelectors,
      });

    const matches = inMemoryDeploymentResourceSelector.selectorMatches;

    const computed: { resourceId: string; deploymentId: string }[] = [];
    for (const [resourceId, deploymentIds] of matches)
      for (const deploymentId of deploymentIds)
        computed.push({ resourceId, deploymentId });

    log.info(
      `Inserting ${computed.length} initial computed deployment resources`,
    );

    if (computed.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < computed.length; i += batchSize) {
        const batch = computed.slice(i, i + batchSize);
        await dbClient
          .insert(schema.computedDeploymentResource)
          .values(batch)
          .onConflictDoNothing();
      }
    }

    return inMemoryDeploymentResourceSelector;
  }

  upsertEntity(entity: FullResource): void {
    if (this.matches.get(entity.id) == null)
      this.matches.set(entity.id, new Set());
    this.entities.set(entity.id, entity);

    const previouslyMatchingDeployments =
      this.matches.get(entity.id) ?? new Set();
    const currentlyMatchingDeployments = new Set<string>();

    for (const selector of this.selectors.values()) {
      const match = entityMatchesSelector(entity, selector);
      if (match) currentlyMatchingDeployments.add(selector.id);
    }

    const unmatchedDeployments = Array.from(
      previouslyMatchingDeployments,
    ).filter((deploymentId) => !currentlyMatchingDeployments.has(deploymentId));

    const newlyMatchedDeployments = Array.from(
      currentlyMatchingDeployments,
    ).filter(
      (deploymentId) => !previouslyMatchingDeployments.has(deploymentId),
    );

    for (const deploymentId of unmatchedDeployments)
      this.matches.get(entity.id)?.delete(deploymentId);

    for (const deploymentId of newlyMatchedDeployments)
      this.matches.get(entity.id)?.add(deploymentId);

    if (unmatchedDeployments.length > 0)
      dbClient
        .delete(schema.computedDeploymentResource)
        .where(
          and(
            eq(schema.computedDeploymentResource.resourceId, entity.id),
            inArray(
              schema.computedDeploymentResource.deploymentId,
              unmatchedDeployments,
            ),
          ),
        )
        .catch((error) => {
          log.error("Error deleting computed deployment resources", {
            error,
            entityId: entity.id,
            unmatchedDeployments,
          });
        });

    if (newlyMatchedDeployments.length > 0)
      dbClient
        .insert(schema.computedDeploymentResource)
        .values(
          newlyMatchedDeployments.map((deploymentId) => ({
            resourceId: entity.id,
            deploymentId,
          })),
        )
        .onConflictDoNothing()
        .catch((error) => {
          log.error("Error inserting computed deployment resources", {
            error,
            entityId: entity.id,
            newlyMatchedDeployments,
          });
        });
  }
  removeEntity(entity: FullResource): void {
    this.entities.delete(entity.id);
    this.matches.delete(entity.id);
    dbClient
      .delete(schema.computedDeploymentResource)
      .where(eq(schema.computedDeploymentResource.resourceId, entity.id))
      .catch((error) => {
        log.error("Error deleting computed deployment resources", {
          error,
          entityId: entity.id,
        });
      });
  }

  upsertSelector(selector: schema.Deployment): void {
    this.selectors.set(selector.id, selector);

    const previouslyMatchingResources: string[] = [];
    for (const [resourceId, deploymentIds] of this.matches)
      if (deploymentIds.has(selector.id))
        previouslyMatchingResources.push(resourceId);

    const currentlyMatchingResources: string[] = [];
    for (const entity of this.entities.values())
      if (entityMatchesSelector(entity, selector))
        currentlyMatchingResources.push(entity.id);

    const unmatchedResources = previouslyMatchingResources.filter(
      (resourceId) => !currentlyMatchingResources.includes(resourceId),
    );
    const newlyMatchedResources = currentlyMatchingResources.filter(
      (resourceId) => !previouslyMatchingResources.includes(resourceId),
    );

    for (const resourceId of unmatchedResources)
      this.matches.get(resourceId)?.delete(selector.id);

    for (const resourceId of newlyMatchedResources)
      this.matches.get(resourceId)?.add(selector.id);

    if (unmatchedResources.length > 0)
      dbClient
        .delete(schema.computedDeploymentResource)
        .where(
          and(
            eq(schema.computedDeploymentResource.deploymentId, selector.id),
            inArray(
              schema.computedDeploymentResource.resourceId,
              unmatchedResources,
            ),
          ),
        )
        .catch((error) => {
          log.error("Error deleting computed deployment resources", {
            error,
            selectorId: selector.id,
            unmatchedResources,
          });
        });

    if (newlyMatchedResources.length > 0)
      dbClient
        .insert(schema.computedDeploymentResource)
        .values(
          newlyMatchedResources.map((resourceId) => ({
            resourceId,
            deploymentId: selector.id,
          })),
        )
        .onConflictDoNothing()
        .catch((error) => {
          log.error("Error inserting computed deployment resources", {
            error,
            selectorId: selector.id,
            newlyMatchedResources,
          });
        });
  }
  removeSelector(selector: schema.Deployment): void {
    this.selectors.delete(selector.id);

    for (const deploymentIds of this.matches.values())
      if (deploymentIds.has(selector.id)) deploymentIds.delete(selector.id);

    dbClient
      .delete(schema.computedDeploymentResource)
      .where(eq(schema.computedDeploymentResource.deploymentId, selector.id))
      .catch((error) => {
        log.error("Error deleting computed deployment resources", {
          error,
          selectorId: selector.id,
        });
      });
  }
  getEntitiesForSelector(selector: schema.Deployment): FullResource[] {
    const resourceIds: string[] = [];
    for (const [resourceId, deploymentIds] of this.matches)
      if (deploymentIds.has(selector.id)) resourceIds.push(resourceId);

    return resourceIds
      .map((resourceId) => this.entities.get(resourceId))
      .filter(isPresent);
  }

  getSelectorsForEntity(entity: FullResource): schema.Deployment[] {
    const matchingDeploymentIds =
      this.matches.get(entity.id) ?? new Set<string>();
    const matchingDeployments = Array.from(matchingDeploymentIds)
      .map((deploymentId) => this.selectors.get(deploymentId))
      .filter(isPresent);
    return matchingDeployments;
  }
  getAllEntities(): FullResource[] {
    return Array.from(this.entities.values());
  }
  getAllSelectors(): schema.Deployment[] {
    return Array.from(this.selectors.values());
  }
  isMatch(entity: FullResource, selector: schema.Deployment): boolean {
    return this.matches.get(entity.id)?.has(selector.id) ?? false;
  }
}
