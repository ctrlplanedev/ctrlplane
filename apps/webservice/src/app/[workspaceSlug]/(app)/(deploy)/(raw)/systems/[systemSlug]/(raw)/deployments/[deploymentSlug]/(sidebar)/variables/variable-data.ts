import type * as schema from "@ctrlplane/db/schema";

export type VariableValue = schema.DeploymentVariableValue & {
  resources: (schema.Resource & {
    resolvedValue: string | number | boolean | object | null;
  })[];
};

export type VariableData = schema.DeploymentVariable & {
  values: VariableValue[];
};
