import _ from "lodash";

import { selector } from "@ctrlplane/db";
import { Channel, createWorker } from "@ctrlplane/events";

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async ({ data }) => {
    const { oldSelector, resourceSelector } = data;
    if (_.isEqual(oldSelector, resourceSelector)) return;
    await selector()
      .compute()
      .deployments([data.id])
      .resourceSelectors()
      .replace();
  },
);
