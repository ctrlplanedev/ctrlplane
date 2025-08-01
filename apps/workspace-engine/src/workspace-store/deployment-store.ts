import { isPresent } from "ts-is-present";

import type { Deployment } from "../entity-types.js";
import type { EntityStore } from "./entity-store.js";

export class DeploymentStore implements EntityStore<Deployment> {
  private deployments = new Map<string, Deployment>();

  loadEntities(deployments: Deployment[]) {
    for (const deployment of deployments)
      this.deployments.set(deployment.id, deployment);
  }

  upsertEntity(deployment: Deployment) {
    this.deployments.set(deployment.id, deployment);
  }

  removeEntity(deploymentId: string) {
    this.deployments.delete(deploymentId);
  }

  removeEntities(deploymentIds: string[]) {
    for (const deploymentId of deploymentIds)
      this.deployments.delete(deploymentId);
  }

  getEntity(deploymentId: string) {
    return this.deployments.get(deploymentId);
  }

  getEntities(deploymentIds: string[]) {
    return deploymentIds
      .map((id) => this.deployments.get(id))
      .filter(isPresent);
  }

  getAllEntities() {
    return Array.from(this.deployments.values());
  }
}
