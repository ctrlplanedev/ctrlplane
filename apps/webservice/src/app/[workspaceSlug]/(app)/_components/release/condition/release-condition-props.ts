import type { ReleaseCondition } from "@ctrlplane/validators/releases";

export type ReleaseConditionRenderProps<T extends ReleaseCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  onRemove?: () => void;
  depth?: number;
  className?: string;
};
