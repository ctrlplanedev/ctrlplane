import type { ResourceCondition } from "@ctrlplane/validators/resources";

export type TargetConditionRenderProps<T extends ResourceCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
