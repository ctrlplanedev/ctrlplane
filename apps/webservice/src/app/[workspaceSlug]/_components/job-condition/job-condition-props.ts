import type { JobCondition } from "@ctrlplane/validators/jobs";

export type JobConditionRenderProps<T extends JobCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  onRemove?: () => void;
  depth?: number;
  className?: string;
};
