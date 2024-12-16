import type { ResourceCondition } from "@ctrlplane/validators/resources";

export type ResourceConditionRenderProps<T extends ResourceCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  depth?: number;
  className?: string;
};
