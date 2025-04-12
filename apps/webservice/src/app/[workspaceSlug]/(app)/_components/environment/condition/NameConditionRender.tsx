import type {
  ColumnOperatorType,
  NameCondition,
} from "@ctrlplane/validators/conditions";

import type { EnvironmentConditionRenderProps } from "./environment-condition-props";
import { ColumnConditionRender } from "../../filter/ColumnConditionRender";

export const NameConditionRender: React.FC<
  EnvironmentConditionRenderProps<NameCondition>
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
