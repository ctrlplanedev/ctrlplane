import type {
  CreatedAtCondition,
  DateOperatorType,
} from "@ctrlplane/validators/conditions";

import type { ResourceConditionRenderProps } from "./resource-condition-props";
import { DateConditionRender } from "../filter/DateConditionRender";

export const ResourceCreatedAtConditionRender: React.FC<
  ResourceConditionRenderProps<CreatedAtCondition>
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
