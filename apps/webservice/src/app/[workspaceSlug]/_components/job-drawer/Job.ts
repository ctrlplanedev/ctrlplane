import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";

export type Job = SCHEMA.ReleaseJobTrigger & {
  job: Omit<SCHEMA.Job, "status"> & {
    metadata: SCHEMA.JobMetadata[];
    status: JobStatus;
    variables: SCHEMA.JobVariable[];
  };
  jobAgent: SCHEMA.JobAgent;
  target: SCHEMA.Target;
  release: SCHEMA.Release & { deployment: SCHEMA.Deployment };
  environment: SCHEMA.Environment;
  rolloutDate: Date | null;
  causedBy?: SCHEMA.User | null;
};
