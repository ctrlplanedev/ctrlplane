import type { DeploymentCondition } from "@ctrlplane/validators/deployments";

export type DeploymentConditionRenderProps<T extends DeploymentCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
