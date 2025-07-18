import type * as schema from "@ctrlplane/db/schema";

export type Job = {
  id: string;
  status: string;
  createdAt: Date;
  metadata: Record<string, string>;
};

export type Version = {
  id: string;
  name: string;
  tag: string;
  job: Job;
};

export type Deployment = schema.Deployment & {
  version: Version | null;
  releaseTarget: schema.ReleaseTarget;
};

export type System = schema.System & {
  environment: schema.Environment;
  deployments: Deployment[];
};
