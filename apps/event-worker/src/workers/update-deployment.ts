import { computeDeploymentComputedResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker } from "@ctrlplane/events";

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  ({ data: deployment }) =>
    db.transaction((tx) =>
      computeDeploymentComputedResources(tx, deployment.id),
    ),
);
