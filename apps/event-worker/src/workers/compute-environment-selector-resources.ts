import { computeEnvironmentSelectorResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker } from "@ctrlplane/events";

export const computeEnvironmentSelectorResourcesWorker = createWorker(
  Channel.ComputeEnvironmentSelectorResources,
  ({ data: { environmentId } }) =>
    db.transaction((tx) =>
      computeEnvironmentSelectorResources(tx, environmentId),
    ),
);
