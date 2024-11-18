import type * as schema from "@ctrlplane/db/schema";

export type VariableValue = schema.DeploymentVariableValue & {
  targets: schema.Resource[];
  targetCount: number;
  filterHash: string;
};

export type VariableData = schema.DeploymentVariable & {
  values: VariableValue[];
};
