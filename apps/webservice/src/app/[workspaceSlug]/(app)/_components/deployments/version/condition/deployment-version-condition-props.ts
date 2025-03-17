import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";

export type DeploymentVersionConditionRenderProps<
  T extends DeploymentVersionCondition,
> = {
  condition: T;
  onChange: (condition: T) => void;
  onRemove?: () => void;
  depth?: number;
  className?: string;
};
