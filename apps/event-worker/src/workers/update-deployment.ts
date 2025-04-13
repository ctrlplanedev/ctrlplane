import _ from "lodash";

import { computeDeploymentComputedResources } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker } from "@ctrlplane/events";

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async ({ data }) => {
    const { oldSelector, resourceSelector } = data;
    if (_.isEqual(oldSelector, resourceSelector)) return;

    await db.transaction((tx) =>
      computeDeploymentComputedResources(tx, data.id),
    );
  },
);
