import { isPresent } from "ts-is-present";

import type { Resource } from "../entity-types.js";
import type { EntityStore } from "./entity-store.js";

export class ResourceStore implements EntityStore<Resource> {
  private resources = new Map<string, Resource>();

  loadEntities(resources: Resource[]): void {
    for (const resource of resources) this.resources.set(resource.id, resource);
  }
  upsertEntity(resource: Resource): void {
    this.resources.set(resource.id, resource);
  }
  removeEntity(resourceId: string): void {
    this.resources.delete(resourceId);
  }
  removeEntities(resourceIds: string[]): void {
    for (const resourceId of resourceIds) this.resources.delete(resourceId);
  }
  getEntity(resourceId: string): Resource | undefined {
    return this.resources.get(resourceId);
  }
  getEntities(resourceIds: string[]): Resource[] {
    return resourceIds.map((id) => this.resources.get(id)).filter(isPresent);
  }

  getAllEntities() {
    return Array.from(this.resources.values());
  }
}
