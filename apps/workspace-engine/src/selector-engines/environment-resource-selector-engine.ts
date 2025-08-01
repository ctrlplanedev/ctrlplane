import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";

import {
  ConditionType,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import type { SelectorEngine } from "./selector-engine.js";
import { DateComparisonFn, StringComparisonFn } from "./common.js";

type Resource = schema.Resource & { metadata: Record<string, string> };

export class EnvironmentResourceSelectorEngine
  implements SelectorEngine<Resource, schema.Environment>
{
  private resources: Map<string, Resource>;
  private environments: Map<string, schema.Environment>;

  constructor() {
    this.resources = new Map();
    this.environments = new Map();
  }

  loadEntities(resources: Resource[]): void {
    for (const resource of resources) this.resources.set(resource.id, resource);
  }
  upsertEntity(resource: Resource): void {
    this.resources.set(resource.id, resource);
  }
  removeEntities(resourceIds: string[]): void {
    for (const resourceId of resourceIds) this.resources.delete(resourceId);
  }

  loadSelectors(environments: schema.Environment[]): void {
    for (const environment of environments)
      this.environments.set(environment.id, environment);
  }
  upsertSelector(environment: schema.Environment): void {
    this.environments.set(environment.id, environment);
  }
  removeSelectors(ids: string[]): void {
    for (const id of ids) this.environments.delete(id);
  }

  getMatchesForEntity(resource: Resource): schema.Environment[] {
    return Array.from(this.environments.values()).filter((environment) =>
      isResourceMatchingCondition(resource, environment.resourceSelector),
    );
  }

  getMatchesForSelector(environment: schema.Environment): Resource[] {
    return Array.from(this.resources.values()).filter((resource) =>
      isResourceMatchingCondition(resource, environment.resourceSelector),
    );
  }
}

const isResourceMatchingCondition = (
  resource: Resource,
  condition: ResourceCondition | null,
): boolean => {
  if (condition == null) return false;

  if (condition.type === ResourceConditionType.Id)
    return resource.id === condition.value;
  if (condition.type === ResourceConditionType.Kind)
    return resource.kind === condition.value;
  if (condition.type === ResourceConditionType.Provider)
    return resource.providerId === condition.value;
  if (condition.type === ResourceConditionType.Version)
    return resource.version === condition.value;

  if (condition.type === ResourceConditionType.Identifier)
    return StringComparisonFn[condition.operator](
      resource.identifier,
      condition.value,
    );
  if (condition.type === ResourceConditionType.Name)
    return StringComparisonFn[condition.operator](
      resource.name,
      condition.value,
    );

  if (condition.type === ResourceConditionType.LastSync) {
    if (resource.updatedAt === null) return false;
    const date = new Date(condition.value);
    return DateComparisonFn[condition.operator](resource.updatedAt, date);
  }

  if (condition.type === ConditionType.CreatedAt) {
    const date = new Date(condition.value);
    return DateComparisonFn[condition.operator](resource.createdAt, date);
  }

  if (condition.type === ResourceConditionType.Metadata) {
    const entry = resource.metadata[condition.key];
    if (condition.operator === MetadataOperator.Null) return entry == null;
    if (condition.operator === undefined) return entry === condition.value;
    if (entry == null) return false;
    return StringComparisonFn[condition.operator](entry, condition.value);
  }

  const { conditions: subConditions } = condition;
  if (subConditions.length === 0) return false;
  const { not = false } = condition;

  const isSubconditionsMatching = subConditions.every((c) =>
    isResourceMatchingCondition(resource, c),
  );
  if (not) return !isSubconditionsMatching;
  return isSubconditionsMatching;
};
