import type {
  CreatedAtCondition,
  DateOperatorType,
} from "@ctrlplane/validators/conditions";

import type { JobConditionRenderProps } from "./job-condition-props";
import { DateConditionRender } from "../../filter/DateConditionRender";

export const JobCreatedAtConditionRender: React.FC<
  JobConditionRenderProps<CreatedAtCondition>
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
      type="Created at"
      className={className}
    />
  );
};
