import type { Event, EventPayload } from "@ctrlplane/events";

import type { Deployment, Environment, Resource } from "../entity-types";
import type { WorkspaceStore } from "../workspace-store/workspace-store";
import { isResourceMatchingCondition } from "../selector-engines/resource-selectors.js";

const getMatchingEnvironments = (
  workspaceStore: WorkspaceStore,
  resource: Resource,
) => {
  const allEnvironments = workspaceStore.environments.getAllEntities();
  return allEnvironments.filter((environment) =>
    isResourceMatchingCondition(resource, environment.resourceSelector),
  );
};

const getMatchingDeployments = (
  workspaceStore: WorkspaceStore,
  resource: Resource,
) => {
  const allDeployments = workspaceStore.deployments.getAllEntities();
  return allDeployments.filter(
    (deployment) =>
      deployment.resourceSelector == null ||
      isResourceMatchingCondition(resource, deployment.resourceSelector),
  );
};

const getEnvironmentDeploymentPairs = (
  environments: Environment[],
  deployments: Deployment[],
) =>
  environments.flatMap((environment) =>
    deployments
      .filter(({ systemId }) => systemId === environment.systemId)
      .map((deployment) => ({ environment, deployment })),
  );

export const handleResourceCreated = async (
  workspaceStore: WorkspaceStore,
  event: EventPayload[Event.ResourceCreated],
) => {
  const resource = event;
  workspaceStore.resources.upsertEntity(resource);

  const matchingEnvironments = getMatchingEnvironments(
    workspaceStore,
    resource,
  );

  const matchingDeployments = getMatchingDeployments(workspaceStore, resource);

  const environmentDeploymentPairs = getEnvironmentDeploymentPairs(
    matchingEnvironments,
    matchingDeployments,
  );

  for (const { environment, deployment } of environmentDeploymentPairs) {
    console.log(environment, deployment);
  }

  await Promise.resolve();
};
