import type { EnvironmentCondition } from "@ctrlplane/validators/environments";

export type EnvironmentConditionRenderProps<T extends EnvironmentCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
