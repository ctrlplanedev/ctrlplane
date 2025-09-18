import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
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

import type { Selector } from "../selector.js";

type DbEnvironmentResourceSelectorOptions = {
  workspaceId: string;
  db?: Tx;
};

export class DbEnvironmentResourceSelector
  implements Selector<schema.Environment, FullResource>
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

  private async removeComputedEnvironmentResourcesForEntity(
    entity: schema.Resource,
    environmentIds: string[],
  ) {
    await this.db
      .delete(schema.computedEnvironmentResource)
      .where(
        and(
          eq(schema.computedEnvironmentResource.resourceId, entity.id),
          inArray(
            schema.computedEnvironmentResource.environmentId,
            environmentIds,
          ),
        ),
      );
  }

  private async insertComputedEnvironmentResourcesForEntity(
    entity: schema.Resource,
    environmentIds: string[],
  ) {
    if (environmentIds.length === 0) return;
    await this.db.insert(schema.computedEnvironmentResource).values(
      environmentIds.map((environmentId) => ({
        environmentId,
        resourceId: entity.id,
      })),
    );
  }

  async upsertEntity(entity: FullResource) {
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

    const unmatchedEnvironments = previouslyMatchedEnvironments.filter(
      (env) => !currEnvIds.has(env.id),
    );
    const newlyMatchedEnvironments = currentlyMatchingEnvironments.filter(
      (env) => !prevEnvIds.has(env.id),
    );

    await Promise.all([
      this.removeComputedEnvironmentResourcesForEntity(
        entity,
        unmatchedEnvironments.map(({ id }) => id),
      ),
      this.insertComputedEnvironmentResourcesForEntity(
        entity,
        newlyMatchedEnvironments.map(({ id }) => id),
      ),
    ]);
  }

  async removeEntity(entity: FullResource) {
    const previouslyMatchedEnvironments =
      await this.getPreviouslyMatchedEnvironments(entity);

    await this.db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, entity.id));

    await this.removeComputedEnvironmentResourcesForEntity(
      entity,
      previouslyMatchedEnvironments.map(({ id }) => id),
    );
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

  private async removeComputedEnvironmentResourcesForSelector(
    selector: schema.Environment,
    resourceIds: string[],
  ) {
    if (resourceIds.length === 0) return;
    await this.db
      .delete(schema.computedEnvironmentResource)
      .where(
        and(
          eq(schema.computedEnvironmentResource.environmentId, selector.id),
          inArray(schema.computedEnvironmentResource.resourceId, resourceIds),
        ),
      );
  }

  private async insertComputedEnvironmentResourcesForSelector(
    selector: schema.Environment,
    resourceIds: string[],
  ) {
    if (resourceIds.length === 0) return;
    await this.db.insert(schema.computedEnvironmentResource).values(
      resourceIds.map((resourceId) => ({
        environmentId: selector.id,
        resourceId,
      })),
    );
  }
  async upsertSelector(selector: schema.Environment) {
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

    const unmatchedResources = previouslyMatchedResources.filter(
      (resource) => !currResourceIds.has(resource.id),
    );
    const newlyMatchedResources = currentlyMatchingResources.filter(
      (resource) => !prevResourceIds.has(resource.id),
    );

    await Promise.all([
      this.removeComputedEnvironmentResourcesForSelector(
        selector,
        unmatchedResources.map(({ id }) => id),
      ),
      this.insertComputedEnvironmentResourcesForSelector(
        selector,
        newlyMatchedResources.map(({ id }) => id),
      ),
    ]);
  }

  async removeSelector(selector: schema.Environment) {
    await this.db
      .delete(schema.environment)
      .where(eq(schema.environment.id, selector.id));
  }

  async getEntitiesForSelector(
    selector: schema.Environment,
  ): Promise<FullResource[]> {
    const dbResult = await this.db
      .select()
      .from(schema.computedEnvironmentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
      )
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(eq(schema.computedEnvironmentResource.environmentId, selector.id));

    return _.chain(dbResult)
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

  async getAllEntities(): Promise<FullResource[]> {
    const dbResult = await this.db
      .select()
      .from(schema.resource)
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(
        and(
          eq(schema.resource.workspaceId, this.workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      );

    return _.chain(dbResult)
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
    entity: FullResource,
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
