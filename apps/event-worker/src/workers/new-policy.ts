import { selector } from "@ctrlplane/db";
import { Channel, createWorker } from "@ctrlplane/events";

export const newPolicyWorker = createWorker(Channel.NewPolicy, async (job) => {
  await selector().compute().policies([job.data.id]).releaseTargetSelectors();
});
