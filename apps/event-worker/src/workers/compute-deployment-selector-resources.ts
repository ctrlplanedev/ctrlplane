import { computeDeploymentComputedResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker } from "@ctrlplane/events";

export const computeDeploymentSelectorResourcesWorker = createWorker(
  Channel.ComputeDeploymentSelectorResources,
  ({ data: { deploymentId } }) =>
    db.transaction((tx) =>
      computeDeploymentComputedResources(tx, deploymentId),
    ),
);
