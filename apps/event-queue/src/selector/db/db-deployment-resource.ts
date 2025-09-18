import type { Tx } from "@ctrlplane/db";
import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNull,
  selector,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Selector } from "../selector.js";

type DbDeploymentResourceSelectorOptions = {
  workspaceId: string;
  db?: Tx;
};

export class DbDeploymentResourceSelector
  implements Selector<schema.Deployment, FullResource>
{
  private db: Tx;
  private workspaceId: string;

  constructor(opts: DbDeploymentResourceSelectorOptions) {
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

  private async getPreviouslyMatchedDeployments(resource: schema.Resource) {
    return this.db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.deployment,
        eq(
          schema.computedDeploymentResource.deploymentId,
          schema.deployment.id,
        ),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.computedDeploymentResource.resourceId, resource.id),
          eq(schema.system.workspaceId, this.workspaceId),
        ),
      )
      .then((results) => results.map(({ deployment }) => deployment));
  }

  private async getMatchableDeployments() {
    return this.db
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId));
  }

  private async getResourceMatchesDeployment(
    resource: schema.Resource,
    deployment: schema.Deployment,
  ) {
    const { resourceSelector } = deployment;
    if (resourceSelector == null) return deployment;

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

    return resourceMatch != null ? deployment : null;
  }

  private async getCurrentlyMatchingDeployments(resource: schema.Resource) {
    const wsDeployments = await this.getMatchableDeployments();

    const matchingDeploymentsPromise = wsDeployments.map(({ deployment }) =>
      this.getResourceMatchesDeployment(resource, deployment),
    );

    return Promise.all(matchingDeploymentsPromise).then((results) =>
      results.filter(isPresent),
    );
  }

  private async removeComputedDeploymentResourcesForEntity(
    entity: schema.Resource,
    deploymentIds: string[],
  ) {
    if (deploymentIds.length === 0) return;

    await this.db
      .delete(schema.computedDeploymentResource)
      .where(
        and(
          eq(schema.computedDeploymentResource.resourceId, entity.id),
          inArray(
            schema.computedDeploymentResource.deploymentId,
            deploymentIds,
          ),
        ),
      );
  }

  private async insertComputedDeploymentResourcesForEntity(
    entity: schema.Resource,
    deploymentIds: string[],
  ) {
    if (deploymentIds.length === 0) return;

    await this.db.insert(schema.computedDeploymentResource).values(
      deploymentIds.map((deploymentId) => ({
        deploymentId,
        resourceId: entity.id,
      })),
    );
  }

  async upsertEntity(entity: FullResource) {
    await this.upsertResource(entity);
    const [previouslyMatchedDeployments, currentlyMatchingDeployments] =
      await Promise.all([
        this.getPreviouslyMatchedDeployments(entity),
        this.getCurrentlyMatchingDeployments(entity),
      ]);

    const prevDeploymentIds = new Set(
      previouslyMatchedDeployments.map(({ id }) => id),
    );
    const currDeploymentIds = new Set(
      currentlyMatchingDeployments.map(({ id }) => id),
    );

    const unmatchedDeployments = previouslyMatchedDeployments.filter(
      (deployment) => !currDeploymentIds.has(deployment.id),
    );
    const newlyMatchedDeployments = currentlyMatchingDeployments.filter(
      (deployment) => !prevDeploymentIds.has(deployment.id),
    );

    await Promise.all([
      this.removeComputedDeploymentResourcesForEntity(
        entity,
        unmatchedDeployments.map(({ id }) => id),
      ),
      this.insertComputedDeploymentResourcesForEntity(
        entity,
        newlyMatchedDeployments.map(({ id }) => id),
      ),
    ]);
  }

  async removeEntity(entity: schema.Resource) {
    const previouslyMatchedDeployments =
      await this.getPreviouslyMatchedDeployments(entity);

    await this.db
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(eq(schema.resource.id, entity.id));

    await this.removeComputedDeploymentResourcesForEntity(
      entity,
      previouslyMatchedDeployments.map(({ id }) => id),
    );
  }

  private async upsertDeployment(deployment: schema.Deployment) {
    await this.db
      .insert(schema.deployment)
      .values(deployment)
      .onConflictDoUpdate({
        target: [schema.deployment.id],
        set: buildConflictUpdateColumns(schema.deployment, [
          "resourceSelector",
        ]),
      });
  }

  private async getPreviouslyMatchedResources(deployment: schema.Deployment) {
    return this.db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
      )
      .where(
        and(
          eq(schema.computedDeploymentResource.deploymentId, deployment.id),
          eq(schema.resource.workspaceId, this.workspaceId),
          isNull(schema.resource.deletedAt),
        ),
      )
      .then((results) => results.map(({ resource }) => resource));
  }

  private async getCurrentlyMatchingResources(deployment: schema.Deployment) {
    return this.db
      .select()
      .from(schema.resource)
      .where(
        and(
          eq(schema.resource.workspaceId, this.workspaceId),
          selector(this.db)
            .query()
            .resources()
            .where(deployment.resourceSelector)
            .sql(),
          isNull(schema.resource.deletedAt),
        ),
      );
  }

  private async removeComputedDeploymentResourcesForSelector(
    selector: schema.Deployment,
    resourceIds: string[],
  ) {
    if (resourceIds.length === 0) return;

    await this.db
      .delete(schema.computedDeploymentResource)
      .where(
        and(
          eq(schema.computedDeploymentResource.deploymentId, selector.id),
          inArray(schema.computedDeploymentResource.resourceId, resourceIds),
        ),
      );
  }

  private async insertComputedDeploymentResourcesForSelector(
    selector: schema.Deployment,
    resourceIds: string[],
  ) {
    if (resourceIds.length === 0) return;

    await this.db.insert(schema.computedDeploymentResource).values(
      resourceIds.map((resourceId) => ({
        deploymentId: selector.id,
        resourceId,
      })),
    );
  }

  async upsertSelector(selector: schema.Deployment) {
    const previouslyMatchedResources =
      await this.getPreviouslyMatchedResources(selector);
    await this.upsertDeployment(selector);
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
      this.removeComputedDeploymentResourcesForSelector(
        selector,
        unmatchedResources.map(({ id }) => id),
      ),
      this.insertComputedDeploymentResourcesForSelector(
        selector,
        newlyMatchedResources.map(({ id }) => id),
      ),
    ]);
  }

  async removeSelector(selector: schema.Deployment) {
    await this.db
      .delete(schema.deployment)
      .where(eq(schema.deployment.id, selector.id));
  }

  async getEntitiesForSelector(selector: schema.Deployment) {
    const dbResult = await this.db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.resource,
        eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
      )
      .leftJoin(
        schema.resourceMetadata,
        eq(schema.resource.id, schema.resourceMetadata.resourceId),
      )
      .where(eq(schema.computedDeploymentResource.deploymentId, selector.id));

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

  async getSelectorsForEntity(entity: FullResource) {
    return this.db
      .select()
      .from(schema.computedDeploymentResource)
      .innerJoin(
        schema.deployment,
        eq(
          schema.computedDeploymentResource.deploymentId,
          schema.deployment.id,
        ),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(
        and(
          eq(schema.computedDeploymentResource.resourceId, entity.id),
          eq(schema.system.workspaceId, this.workspaceId),
        ),
      )
      .then((results) => results.map(({ deployment }) => deployment));
  }

  async getAllEntities() {
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

  async getAllSelectors() {
    return this.db
      .select()
      .from(schema.deployment)
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, this.workspaceId))
      .then((results) => results.map(({ deployment }) => deployment));
  }

  async isMatch(entity: schema.Resource, selector: schema.Deployment) {
    return this.db
      .select()
      .from(schema.computedDeploymentResource)
      .where(
        and(
          eq(schema.computedDeploymentResource.resourceId, entity.id),
          eq(schema.computedDeploymentResource.deploymentId, selector.id),
        ),
      )
      .then(takeFirstOrNull)
      .then((result) => result != null);
  }
}
