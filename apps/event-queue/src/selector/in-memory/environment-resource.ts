import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import type { Selector } from "../selector.js";
import { resourceMatchesSelector } from "./resource-match.js";

const log = logger.child({
  module: "in-memory-environment-resource-selector",
});

type InMemoryEnvironmentResourceSelectorOptions = {
  initialEntities: FullResource[];
  initialSelectors: schema.Environment[];
};

const entityMatchesSelector = (
  entity: FullResource,
  selector: schema.Environment,
) => {
  if (selector.resourceSelector == null) return false;
  return resourceMatchesSelector(entity, selector.resourceSelector);
};

export class InMemoryEnvironmentResourceSelector
  implements Selector<schema.Environment, FullResource>
{
  private entities: Map<string, FullResource>;
  private selectors: Map<string, schema.Environment>;
  private matches: Map<string, Set<string>>; // resourceId -> environmentId

  constructor(opts: InMemoryEnvironmentResourceSelectorOptions) {
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
          selector.resourceSelector == null ||
          resourceMatchesSelector(entity, selector.resourceSelector);
        if (match) this.matches.get(entity.id)?.add(selector.id);
      }
    }
  }

  get selectorMatches() {
    return this.matches;
  }

  static async create(workspaceId: string) {
    const allEntitiesDbResult = await dbClient
      .select()
      .from(schema.resource)
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      );

    const allEntities = _.chain(allEntitiesDbResult)
      .groupBy((row) => row.resource.id)
      .map((group) => {
        const [first] = group;
        if (first == null) return null;
        const { resource } = first;
        const metadata = Object.fromEntries(
          group
            .map((r) => r.resource_metadata)
            .filter(isPresent)
            .map((m) => [m.key, m.value]),
        );
        return { ...resource, metadata };
      })
      .value()
      .filter(isPresent);

    const allSelectors = await dbClient
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((results) => results.map((result) => result.environment));

    const inMemoryEnvironmentResourceSelector =
      new InMemoryEnvironmentResourceSelector({
        initialEntities: allEntities,
        initialSelectors: allSelectors,
      });

    const matches = inMemoryEnvironmentResourceSelector.selectorMatches;

    const computed: { resourceId: string; environmentId: string }[] = [];
    for (const [resourceId, environmentIds] of matches)
      for (const environmentId of environmentIds)
        computed.push({ resourceId, environmentId });

    log.info(
      `Inserting ${computed.length} initial computed environment resources`,
    );

    if (computed.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < computed.length; i += batchSize) {
        const batch = computed.slice(i, i + batchSize);
        await dbClient
          .insert(schema.computedEnvironmentResource)
          .values(batch)
          .onConflictDoNothing();
      }
    }

    return inMemoryEnvironmentResourceSelector;
  }

  async upsertEntity(entity: FullResource): Promise<void> {
    if (this.matches.get(entity.id) == null)
      this.matches.set(entity.id, new Set());
    this.entities.set(entity.id, entity);

    const previouslyMatchingSelectors =
      this.matches.get(entity.id) ?? new Set();
    const currentlyMatchingSelectors = new Set<string>();

    for (const selector of this.selectors.values()) {
      const match = entityMatchesSelector(entity, selector);
      if (match) currentlyMatchingSelectors.add(selector.id);
    }

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
      await dbClient
        .delete(schema.computedEnvironmentResource)
        .where(
          and(
            eq(schema.computedEnvironmentResource.resourceId, entity.id),
            inArray(
              schema.computedEnvironmentResource.environmentId,
              unmatchedSelectors,
            ),
          ),
        );

    if (newlyMatchedSelectors.length > 0)
      await dbClient
        .insert(schema.computedEnvironmentResource)
        .values(
          newlyMatchedSelectors.map((selectorId) => ({
            resourceId: entity.id,
            environmentId: selectorId,
          })),
        )
        .onConflictDoNothing();
  }
  async removeEntity(entity: FullResource): Promise<void> {
    this.entities.delete(entity.id);
    this.matches.delete(entity.id);
    await dbClient
      .delete(schema.computedEnvironmentResource)
      .where(eq(schema.computedEnvironmentResource.resourceId, entity.id));
  }

  async upsertSelector(selector: schema.Environment): Promise<void> {
    this.selectors.set(selector.id, selector);

    const previouslyMatchingEntities: string[] = [];
    for (const [entityId, selectorIds] of this.matches)
      if (selectorIds.has(selector.id))
        previouslyMatchingEntities.push(entityId);

    const currentlyMatchingEntities: string[] = [];
    for (const entity of this.entities.values())
      if (entityMatchesSelector(entity, selector))
        currentlyMatchingEntities.push(entity.id);

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
      await dbClient
        .delete(schema.computedEnvironmentResource)
        .where(
          and(
            eq(schema.computedEnvironmentResource.environmentId, selector.id),
            inArray(
              schema.computedEnvironmentResource.resourceId,
              unmatchedEntities,
            ),
          ),
        );

    if (newlyMatchedEntities.length > 0)
      await dbClient
        .insert(schema.computedEnvironmentResource)
        .values(
          newlyMatchedEntities.map((entityId) => ({
            resourceId: entityId,
            environmentId: selector.id,
          })),
        )
        .onConflictDoNothing();
  }
  async removeSelector(selector: schema.Environment): Promise<void> {
    this.selectors.delete(selector.id);

    for (const environmentIds of this.matches.values())
      if (environmentIds.has(selector.id)) environmentIds.delete(selector.id);

    await dbClient
      .delete(schema.computedEnvironmentResource)
      .where(eq(schema.computedEnvironmentResource.environmentId, selector.id));
  }
  getEntitiesForSelector(
    selector: schema.Environment,
  ): Promise<FullResource[]> {
    const entityIds: string[] = [];
    for (const [entityId, selectorIds] of this.matches)
      if (selectorIds.has(selector.id)) entityIds.push(entityId);

    return Promise.resolve(
      entityIds
        .map((entityId) => this.entities.get(entityId))
        .filter(isPresent),
    );
  }

  getSelectorsForEntity(entity: FullResource): Promise<schema.Environment[]> {
    const matchingSelectorIds =
      this.matches.get(entity.id) ?? new Set<string>();
    const matchingSelectors = Array.from(matchingSelectorIds)
      .map((selectorId) => this.selectors.get(selectorId))
      .filter(isPresent);
    return Promise.resolve(matchingSelectors);
  }
  getAllEntities(): Promise<FullResource[]> {
    return Promise.resolve(Array.from(this.entities.values()));
  }
  getAllSelectors(): Promise<schema.Environment[]> {
    return Promise.resolve(Array.from(this.selectors.values()));
  }
  isMatch(
    entity: FullResource,
    selector: schema.Environment,
  ): Promise<boolean> {
    return Promise.resolve(
      this.matches.get(entity.id)?.has(selector.id) ?? false,
    );
  }
}
