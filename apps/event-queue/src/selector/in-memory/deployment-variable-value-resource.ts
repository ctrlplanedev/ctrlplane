import type { FullResource } from "@ctrlplane/events";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import { db as dbClient } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { Selector } from "../selector.js";
import { resourceMatchesSelector } from "./resource-match.js";

type InMemoryDeploymentVariableValueResourceSelectorOptions = {
  initialEntities: FullResource[];
  initialSelectors: schema.DeploymentVariableValue[];
};

const entityMatchesSelector = (
  entity: FullResource,
  selector: schema.DeploymentVariableValue,
) => {
  if (selector.resourceSelector == null) return false;
  return resourceMatchesSelector(entity, selector.resourceSelector);
};

export class InMemoryDeploymentVariableValueResourceSelector
  implements Selector<schema.DeploymentVariableValue, FullResource>
{
  private entities: Map<string, FullResource>;
  private selectors: Map<string, schema.DeploymentVariableValue>;
  private matches: Map<string, Set<string>>; // resourceId -> deploymentId

  constructor(opts: InMemoryDeploymentVariableValueResourceSelectorOptions) {
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

  static async create(workspaceId: string, initialEntities: FullResource[]) {
    const allSelectors = await dbClient
      .select()
      .from(schema.deploymentVariableValue)
      .leftJoin(
        schema.deploymentVariableValueDirect,
        eq(
          schema.deploymentVariableValue.id,
          schema.deploymentVariableValueDirect.variableValueId,
        ),
      )
      .leftJoin(
        schema.deploymentVariableValueReference,
        eq(
          schema.deploymentVariableValue.id,
          schema.deploymentVariableValueReference.variableValueId,
        ),
      )
      .innerJoin(
        schema.deploymentVariable,
        eq(
          schema.deploymentVariableValue.variableId,
          schema.deploymentVariable.id,
        ),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVariable.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .where(eq(schema.system.workspaceId, workspaceId))
      .then((results) =>
        results.map((result) => {
          if (result.deployment_variable_value_direct != null)
            return {
              ...result.deployment_variable_value_direct,
              ...result.deployment_variable_value,
            };
          if (result.deployment_variable_value_reference != null)
            return {
              ...result.deployment_variable_value_reference,
              ...result.deployment_variable_value,
            };
          return null;
        }),
      )
      .then((results) => results.filter(isPresent));

    return new InMemoryDeploymentVariableValueResourceSelector({
      initialEntities,
      initialSelectors: allSelectors,
    });
  }

  async upsertEntity(entity: FullResource): Promise<void> {
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
      await dbClient
        .delete(schema.computedDeploymentResource)
        .where(
          and(
            eq(schema.computedDeploymentResource.resourceId, entity.id),
            inArray(
              schema.computedDeploymentResource.deploymentId,
              unmatchedDeployments,
            ),
          ),
        );

    if (newlyMatchedDeployments.length > 0)
      await dbClient
        .insert(schema.computedDeploymentResource)
        .values(
          newlyMatchedDeployments.map((deploymentId) => ({
            resourceId: entity.id,
            deploymentId,
          })),
        )
        .onConflictDoNothing();
  }
  async removeEntity(entity: FullResource): Promise<void> {
    this.entities.delete(entity.id);
    this.matches.delete(entity.id);
    await dbClient
      .delete(schema.computedDeploymentResource)
      .where(eq(schema.computedDeploymentResource.resourceId, entity.id));
  }

  async upsertSelector(
    selector: schema.DeploymentVariableValue,
  ): Promise<void> {
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
      await dbClient
        .delete(schema.computedDeploymentResource)
        .where(
          and(
            eq(schema.computedDeploymentResource.deploymentId, selector.id),
            inArray(
              schema.computedDeploymentResource.resourceId,
              unmatchedResources,
            ),
          ),
        );

    if (newlyMatchedResources.length > 0)
      await dbClient
        .insert(schema.computedDeploymentResource)
        .values(
          newlyMatchedResources.map((resourceId) => ({
            resourceId,
            deploymentId: selector.id,
          })),
        )
        .onConflictDoNothing();
  }
  async removeSelector(
    selector: schema.DeploymentVariableValue,
  ): Promise<void> {
    this.selectors.delete(selector.id);

    for (const deploymentIds of this.matches.values())
      if (deploymentIds.has(selector.id)) deploymentIds.delete(selector.id);

    await dbClient
      .delete(schema.computedDeploymentResource)
      .where(eq(schema.computedDeploymentResource.deploymentId, selector.id));
  }
  getEntitiesForSelector(
    selector: schema.DeploymentVariableValue,
  ): Promise<FullResource[]> {
    const resourceIds: string[] = [];
    for (const [resourceId, deploymentIds] of this.matches)
      if (deploymentIds.has(selector.id)) resourceIds.push(resourceId);

    return Promise.resolve(
      resourceIds
        .map((resourceId) => this.entities.get(resourceId))
        .filter(isPresent),
    );
  }

  getSelectorsForEntity(
    entity: FullResource,
  ): Promise<schema.DeploymentVariableValue[]> {
    const matchingDeploymentIds =
      this.matches.get(entity.id) ?? new Set<string>();
    const matchingDeployments = Array.from(matchingDeploymentIds)
      .map((deploymentId) => this.selectors.get(deploymentId))
      .filter(isPresent);
    return Promise.resolve(matchingDeployments);
  }
  getAllEntities(): Promise<FullResource[]> {
    return Promise.resolve(Array.from(this.entities.values()));
  }
  getAllSelectors(): Promise<schema.DeploymentVariableValue[]> {
    return Promise.resolve(Array.from(this.selectors.values()));
  }
  isMatch(
    entity: FullResource,
    selector: schema.DeploymentVariableValue,
  ): Promise<boolean> {
    return Promise.resolve(
      this.matches.get(entity.id)?.has(selector.id) ?? false,
    );
  }
}
