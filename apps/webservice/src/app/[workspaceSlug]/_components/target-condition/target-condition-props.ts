import type { TargetCondition } from "@ctrlplane/validators/targets";

export type TargetConditionRenderProps<T extends TargetCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
