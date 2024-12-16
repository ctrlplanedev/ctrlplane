import type { ColumnOperatorType } from "@ctrlplane/validators/conditions";
import type { NameCondition } from "@ctrlplane/validators/resources";

import type { ResourceConditionRenderProps } from "./resource-condition-props";
import { ColumnConditionRender } from "../filter/ColumnConditionRender";

export const NameConditionRender: React.FC<
  ResourceConditionRenderProps<NameCondition>
> = ({ condition, onChange, className }) => {
  const setOperator = (operator: ColumnOperatorType) =>
    onChange({ ...condition, operator });
  const setValue = (value: string) => onChange({ ...condition, value });

  return (
    <ColumnConditionRender
      operator={condition.operator}
      value={condition.value}
      setOperator={setOperator}
      setValue={setValue}
      className={className}
      title="Name"
    />
  );
};
