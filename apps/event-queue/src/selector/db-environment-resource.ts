import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNotNull,
  isNull,
  selector,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { MatchChange, Selector } from "./selector.js";
import { MatchChangeType } from "./selector.js";

type DbEnvironmentResourceSelectorOptions = {
  workspaceId: string;
  db?: Tx;
};

export class DbEnvironmentResourceSelector
  implements Selector<schema.Environment, schema.Resource>
{
  private db: Tx;
  private workspaceId: string;

  constructor(opts: DbEnvironmentResourceSelectorOptions) {
    this.db = opts.db ?? dbClient;
    this.workspaceId = opts.workspaceId;
  }

  private async upsertResource(resource: schema.Resource) {
    await this.db
      .insert(schema.resource)
      .values({ ...resource, deletedAt: null })
      .onConflictDoUpdate({
        target: [schema.resource.id],
        set: buildConflictUpdateColumns(schema.resource, [
          "name",
          "kind",
          "version",
          "identifier",
          "providerId",
          "config",
          "lockedAt",
          "deletedAt",
        ]),
      });
  }

  private async getPreviouslyMatchedEnvironments(resource: schema.Resource) {
    return this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .innerJoin(
        schema.environment,
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.environment.id,
        ),
      )
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.computedEnvironmentResource.resourceId, resource.id),
          eq(schema.system.workspaceId, this.workspaceId),
        ),
      )
      .then((results) => results.map(({ environment }) => environment));
  }

  private async getMatchableEnvironments() {
    return this.db
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.system.workspaceId, this.workspaceId),
          isNotNull(schema.environment.resourceSelector),
        ),
      );
  }

  private async getResourceMatchesEnvironment(
    resource: schema.Resource,
    environment: schema.Environment,
  ) {
    const { resourceSelector } = environment;
    if (resourceSelector == null) return null;

    const resourceMatch = await this.db
      .select()
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.id, resource.id),
          selector(this.db).query().resources().where(resourceSelector).sql(),
        ),
      )
      .then(takeFirstOrNull);

    return resourceMatch != null ? environment : null;
  }

  private async getCurrentlyMatchingEnvironments(resource: schema.Resource) {
    const wsEnvironments = await this.getMatchableEnvironments();

    const matchingEnvsPromise = wsEnvironments.map(({ environment }) =>
      this.getResourceMatchesEnvironment(resource, environment),
    );

    return Promise.all(matchingEnvsPromise).then((results) =>
      results.filter(isPresent),
    );
  }

  async upsertEntity(
    entity: schema.Resource,
  ): Promise<MatchChange<schema.Resource, schema.Environment>[]> {
    await this.upsertResource(entity);
    const [previouslyMatchedEnvironments, currentlyMatchingEnvironments] =
      await Promise.all([
        this.getPreviouslyMatchedEnvironments(entity),
        this.getCurrentlyMatchingEnvironments(entity),
      ]);

    const prevEnvIds = new Set(
      previouslyMatchedEnvironments.map(({ id }) => id),
    );
    const currEnvIds = new Set(
      currentlyMatchingEnvironments.map(({ id }) => id),
    );

    const removedMatchChanges = previouslyMatchedEnvironments
      .filter(({ id }) => !currEnvIds.has(id))
      .map((env) => ({
        entity,
        selector: env,
        changeType: MatchChangeType.Removed,
      }));

    const newlyMatchedChanges = currentlyMatchingEnvironments
      .filter(({ id }) => !prevEnvIds.has(id))
      .map((env) => ({
        entity,
        selector: env,
        changeType: MatchChangeType.Added,
      }));

    await Promise.all([
      removedMatchChanges.length > 0
        ? this.db.delete(schema.computedEnvironmentResource).where(
            and(
              eq(schema.computedEnvironmentResource.resourceId, entity.id),
              inArray(
                schema.computedEnvironmentResource.environmentId,
                removedMatchChanges.map(({ selector }) => selector.id),
              ),
            ),
          )
        : Promise.resolve(),
      newlyMatchedChanges.length > 0
        ? this.db.insert(schema.computedEnvironmentResource).values(
            newlyMatchedChanges.map(({ selector }) => ({
              environmentId: selector.id,
              resourceId: entity.id,
            })),
          )
        : Promise.resolve(),
    ]);

    return [...removedMatchChanges, ...newlyMatchedChanges];
  }

  async removeEntity(
    entity: schema.Resource,
  ): Promise<MatchChange<schema.Resource, schema.Environment>[]> {
    const previouslyMatchedEnvironments =
      await this.getPreviouslyMatchedEnvironments(entity);

    const removedMatchChanges = previouslyMatchedEnvironments.map((env) => ({
      entity,
      selector: env,
      changeType: MatchChangeType.Removed,
    }));

    await this.db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, entity.id));

    if (removedMatchChanges.length > 0)
      await this.db.delete(schema.computedEnvironmentResource).where(
        and(
          eq(schema.computedEnvironmentResource.resourceId, entity.id),
          inArray(
            schema.computedEnvironmentResource.environmentId,
            removedMatchChanges.map(({ selector }) => selector.id),
          ),
        ),
      );

    return removedMatchChanges;
  }

  private async upsertEnvironment(environment: schema.Environment) {
    await this.db
      .insert(schema.environment)
      .values(environment)
      .onConflictDoUpdate({
        target: [schema.environment.id],
        set: buildConflictUpdateColumns(schema.environment, [
          "resourceSelector",
        ]),
      });
  }

  private async getPreviouslyMatchedResources(environment: schema.Environment) {
    return this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
      )
      .where(
        eq(schema.computedEnvironmentResource.environmentId, environment.id),
      )
      .then((results) => results.map(({ resource }) => resource));
  }

  private async getCurrentlyMatchingResources(environment: schema.Environment) {
    const { resourceSelector } = environment;
    if (resourceSelector == null) return [];

    return this.db
      .select()
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.workspaceId, this.workspaceId),
          selector(this.db).query().resources().where(resourceSelector).sql(),
          isNull(schema.resource.deletedAt),
        ),
      );
  }

  async upsertSelector(
    selector: schema.Environment,
  ): Promise<MatchChange<schema.Resource, schema.Environment>[]> {
    const previouslyMatchedResources =
      await this.getPreviouslyMatchedResources(selector);
    await this.upsertEnvironment(selector);
    const currentlyMatchingResources =
      await this.getCurrentlyMatchingResources(selector);

    const prevResourceIds = new Set(
      previouslyMatchedResources.map(({ id }) => id),
    );
    const currResourceIds = new Set(
      currentlyMatchingResources.map(({ id }) => id),
    );

    const removedMatchChanges = previouslyMatchedResources
      .filter(({ id }) => !currResourceIds.has(id))
      .map((resource) => ({
        entity: resource,
        selector,
        changeType: MatchChangeType.Removed,
      }));

    const newlyMatchedChanges = currentlyMatchingResources
      .filter(({ id }) => !prevResourceIds.has(id))
      .map((resource) => ({
        entity: resource,
        selector,
        changeType: MatchChangeType.Added,
      }));

    await Promise.all([
      removedMatchChanges.length > 0
        ? this.db.delete(schema.computedEnvironmentResource).where(
            and(
              eq(schema.computedEnvironmentResource.environmentId, selector.id),
              inArray(
                schema.computedEnvironmentResource.resourceId,
                removedMatchChanges.map(({ entity }) => entity.id),
              ),
            ),
          )
        : Promise.resolve(),
      newlyMatchedChanges.length > 0
        ? this.db.insert(schema.computedEnvironmentResource).values(
            newlyMatchedChanges.map(({ entity }) => ({
              environmentId: selector.id,
              resourceId: entity.id,
            })),
          )
        : Promise.resolve(),
    ]);

    return [...removedMatchChanges, ...newlyMatchedChanges];
  }

  async removeSelector(
    selector: schema.Environment,
  ): Promise<MatchChange<schema.Resource, schema.Environment>[]> {
    const previouslyMatchedResources =
      await this.getPreviouslyMatchedResources(selector);

    const removedMatchChanges = previouslyMatchedResources.map((resource) => ({
      entity: resource,
      selector,
      changeType: MatchChangeType.Removed,
    }));

    await this.db
      .delete(schema.environment)
      .where(eq(schema.environment.id, selector.id));

    return removedMatchChanges;
  }

  getEntitiesForSelector(
    selector: schema.Environment,
  ): Promise<schema.Resource[]> {
    return this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
      )
      .where(eq(schema.computedEnvironmentResource.environmentId, selector.id))
      .then((rows) => rows.map(({ resource }) => resource));
  }

  getSelectorsForEntity(
    entity: schema.Resource,
  ): Promise<schema.Environment[]> {
    return this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .innerJoin(
        schema.environment,
        eq(
          schema.computedEnvironmentResource.environmentId,
          schema.environment.id,
        ),
      )
      .where(eq(schema.computedEnvironmentResource.resourceId, entity.id))
      .then((rows) => rows.map(({ environment }) => environment));
  }

  getAllEntities(): Promise<schema.Resource[]> {
    return this.db
      .select()
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.workspaceId, this.workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      );
  }

  getAllSelectors(): Promise<schema.Environment[]> {
    return this.db
      .select()
      .from(schema.environment)
      .innerJoin(
        schema.system,
        eq(schema.environment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((rows) => rows.map(({ environment }) => environment));
  }

  async isMatch(
    entity: schema.Resource,
    selector: schema.Environment,
  ): Promise<boolean> {
    const matchResult = await this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .where(
        and(
          eq(schema.computedEnvironmentResource.resourceId, entity.id),
          eq(schema.computedEnvironmentResource.environmentId, selector.id),
        ),
      )
      .then(takeFirstOrNull);

    return matchResult != null;
  }
}
