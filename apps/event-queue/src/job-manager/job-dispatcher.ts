import type * as schema from "@ctrlplane/db/schema";

export interface JobDispatcher {
  dispatchJob(job: schema.Job): Promise<void>;
}
