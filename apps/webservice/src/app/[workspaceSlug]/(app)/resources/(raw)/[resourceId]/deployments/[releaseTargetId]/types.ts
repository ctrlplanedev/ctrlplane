import type * as schema from "@ctrlplane/db/schema";

export type ReleaseTarget = schema.ReleaseTarget & {
  deployment: schema.Deployment;
  resource: schema.Resource;
  environment: schema.Environment;
};

export type JobWithLinks = schema.Job & { links: Record<string, string> };
export type Version = schema.DeploymentVersion & { jobs: JobWithLinks[] };
