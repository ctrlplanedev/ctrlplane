import type { ResourceCondition } from "@ctrlplane/validators/targets";

export type TargetConditionRenderProps<T extends ResourceCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
