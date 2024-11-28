import type {
  CreatedAtCondition,
  DateOperatorType,
} from "@ctrlplane/validators/conditions";
import type { DateValue } from "@internationalized/date";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { DateConditionRender } from "../filter/DateConditionRender";

export const ResourceCreatedAtConditionRender: React.FC<
  TargetConditionRenderProps<CreatedAtCondition>
> = ({ condition, onChange, className }) => {
  const setDate = (t: DateValue) =>
    onChange({
      ...condition,
      value: t
        .toDate(Intl.DateTimeFormat().resolvedOptions().timeZone)
        .toISOString(),
    });

  const setOperator = (operator: DateOperatorType) =>
    onChange({ ...condition, operator });

  return (
    <DateConditionRender
      setDate={setDate}
      setOperator={setOperator}
      value={condition.value}
      operator={condition.operator}
      type="Created at"
      className={className}
    />
  );
};
