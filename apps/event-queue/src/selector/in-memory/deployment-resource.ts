import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, or } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Selector } from "../selector.js";
import { Trace } from "../../traces.js";
import { getFullResources } from "./common.js";
import { resourceMatchesSelector } from "./resource-match.js";

const entityMatchesSelector = (
  entity: FullResource,
  selector: schema.Deployment,
) => {
  if (selector.resourceSelector == null) return false;
  return resourceMatchesSelector(entity, selector.resourceSelector);
};

const log = logger.child({
  module: "in-memory-deployment-resource-selector",
});

type InMemoryDeploymentResourceSelectorOptions = {
  initialEntities: FullResource[];
  initialSelectors: schema.Deployment[];
  workspaceId: string;
};

type Match = { resourceId: string; deploymentId: string };

export class InMemoryDeploymentResourceSelector
  implements Selector<schema.Deployment, FullResource>
{
  private entities: Map<string, FullResource>;
  private selectors: Map<string, schema.Deployment>;
  private matches: Map<string, Set<string>>; // resourceId -> deploymentId
  private workspaceId: string;

  constructor(opts: InMemoryDeploymentResourceSelectorOptions) {
    this.entities = new Map(
      opts.initialEntities.map((entity) => [entity.id, entity]),
    );
    this.selectors = new Map(
      opts.initialSelectors.map((selector) => [selector.id, selector]),
    );
    this.matches = new Map();
    this.workspaceId = opts.workspaceId;

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
        workspaceId,
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
  private getMatches(): Map<string, Set<string>> {
    const copy = new Map<string, Set<string>>();
    for (const [resourceId, deploymentIds] of this.matches.entries()) {
      copy.set(resourceId, new Set(deploymentIds));
    }
    return copy;
  }
  isMatch(entity: FullResource, selector: schema.Deployment): boolean {
    return this.matches.get(entity.id)?.has(selector.id) ?? false;
  }

  @Trace()
  private async getDbSelectors(): Promise<schema.Deployment[]> {
    return dbClient
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((rows) => rows.map((row) => row.deployment));
  }

  private reconcileEntities(dbEntities: FullResource[]): void {
    this.entities.clear();
    for (const entity of dbEntities) this.entities.set(entity.id, entity);
  }

  private reconcileSelectors(dbSelectors: schema.Deployment[]): void {
    this.selectors.clear();
    for (const selector of dbSelectors)
      this.selectors.set(selector.id, selector);
  }

  private reconcileMatches(
    dbEntities: FullResource[],
    dbSelectors: schema.Deployment[],
  ): void {
    this.matches.clear();
    for (const entity of dbEntities) {
      this.matches.set(entity.id, new Set());
      for (const selector of dbSelectors)
        if (entityMatchesSelector(entity, selector))
          this.matches.get(entity.id)?.add(selector.id);
    }
  }

  @Trace()
  private async removeStaleComputedFromDb(
    removedComputedDeploymentResources: Match[],
  ) {
    if (removedComputedDeploymentResources.length === 0) return;
    const isStaleDbMatch = or(
      ...removedComputedDeploymentResources.map((match) =>
        and(
          eq(schema.computedDeploymentResource.resourceId, match.resourceId),
          eq(
            schema.computedDeploymentResource.deploymentId,
            match.deploymentId,
          ),
        ),
      ),
    );

    await dbClient
      .delete(schema.computedDeploymentResource)
      .where(isStaleDbMatch);
  }

  @Trace()
  private async insertNewComputedToDb(newComputedDeploymentResources: Match[]) {
    if (newComputedDeploymentResources.length === 0) return;
    await dbClient
      .insert(schema.computedDeploymentResource)
      .values(newComputedDeploymentResources)
      .onConflictDoNothing();
  }

  @Trace()
  private async reconcileComputedDeploymentResources(
    previousMatches: Map<string, Set<string>>,
    currentMatches: Map<string, Set<string>>,
  ) {
    const removedComputedDeploymentResources: Match[] = [];
    const newComputedDeploymentResources: Match[] = [];

    for (const [resourceId, deploymentIds] of previousMatches)
      for (const deploymentId of deploymentIds)
        if (!currentMatches.get(resourceId)?.has(deploymentId))
          removedComputedDeploymentResources.push({ resourceId, deploymentId });

    for (const [resourceId, deploymentIds] of currentMatches)
      for (const deploymentId of deploymentIds)
        if (!previousMatches.get(resourceId)?.has(deploymentId))
          newComputedDeploymentResources.push({ resourceId, deploymentId });

    await Promise.all([
      this.removeStaleComputedFromDb(removedComputedDeploymentResources),
      this.insertNewComputedToDb(newComputedDeploymentResources),
    ]);
  }

  @Trace("deployment-resource-selector-reconcile")
  async reconcile(): Promise<void> {
    const previousMatches = this.getMatches();
    const [dbSelectors, dbEntities] = await Promise.all([
      this.getDbSelectors(),
      getFullResources(this.workspaceId),
    ]);

    this.reconcileSelectors(dbSelectors);
    this.reconcileEntities(dbEntities);
    this.reconcileMatches(dbEntities, dbSelectors);

    await this.reconcileComputedDeploymentResources(
      previousMatches,
      this.matches,
    );
  }
}
