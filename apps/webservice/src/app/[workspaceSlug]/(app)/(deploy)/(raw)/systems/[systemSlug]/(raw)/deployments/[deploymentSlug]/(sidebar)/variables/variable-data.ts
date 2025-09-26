import type * as schema from "@ctrlplane/db/schema";

export type VariableValue = schema.DeploymentVariableValue & {
  resources: schema.Resource[];
};

export type VariableData = schema.DeploymentVariable & {
  values: VariableValue[];
};
