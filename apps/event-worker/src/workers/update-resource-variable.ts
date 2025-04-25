import _ from "lodash";

import { Channel, createWorker } from "@ctrlplane/events";

export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async () => {
    // todo:?
  },
);
