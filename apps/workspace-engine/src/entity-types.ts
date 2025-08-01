import type * as schema from "@ctrlplane/db/schema";

export type Resource = schema.Resource & { metadata: Record<string, string> };
export type Environment = schema.Environment;
export type Deployment = schema.Deployment;
