import type * as schema from "@ctrlplane/db/schema";

export type VariableValue = schema.DeploymentVariableValue & {
  targets: schema.Target[];
  targetCount: number;
};

export type VariableData = schema.DeploymentVariable & {
  values: VariableValue[];
};
