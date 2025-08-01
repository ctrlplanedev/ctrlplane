import { isPresent } from "ts-is-present";

import type { Environment } from "../entity-types.js";
import type { EntityStore } from "./entity-store.js";

export class EnvironmentStore implements EntityStore<Environment> {
  private environments = new Map<string, Environment>();

  loadEntities(environments: Environment[]) {
    for (const environment of environments)
      this.environments.set(environment.id, environment);
  }

  upsertEntity(environment: Environment) {
    this.environments.set(environment.id, environment);
  }

  removeEntity(environmentId: string) {
    this.environments.delete(environmentId);
  }

  removeEntities(environmentIds: string[]) {
    for (const environmentId of environmentIds)
      this.environments.delete(environmentId);
  }

  getEntity(environmentId: string) {
    return this.environments.get(environmentId);
  }

  getEntities(environmentIds: string[]) {
    return environmentIds
      .map((id) => this.environments.get(id))
      .filter(isPresent);
  }

  getAllEntities() {
    return Array.from(this.environments.values());
  }
}
