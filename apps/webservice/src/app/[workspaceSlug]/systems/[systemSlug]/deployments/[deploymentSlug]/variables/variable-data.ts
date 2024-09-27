import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";

export type VariableValue = schema.DeploymentVariableValue & {
  targetFilter: TargetCondition | null;
  targets: schema.Target[];
};

export type VariableData = schema.DeploymentVariable & {
  values: VariableValue[];
};
