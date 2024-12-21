import type { DateOperatorType } from "@ctrlplane/validators/conditions";
import type { LastSyncCondition } from "@ctrlplane/validators/resources";

import type { ResourceConditionRenderProps } from "./resource-condition-props";
import { DateConditionRender } from "../filter/DateConditionRender";

export const ResourceLastSyncConditionRender: React.FC<
  ResourceConditionRenderProps<LastSyncCondition>
> = ({ condition, onChange, className }) => {
  const setDate = (value: Date) =>
    onChange({ ...condition, value: value.toISOString() });

  const setOperator = (operator: DateOperatorType) =>
    onChange({ ...condition, operator });

  return (
    <DateConditionRender
      setDate={setDate}
      setOperator={setOperator}
      value={condition.value}
      operator={condition.operator}
      type="Last sync"
      className={className}
    />
  );
};
