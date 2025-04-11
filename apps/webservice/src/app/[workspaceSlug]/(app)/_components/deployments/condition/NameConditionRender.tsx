import type {
  ColumnOperatorType,
  NameCondition,
} from "@ctrlplane/validators/conditions";

import type { DeploymentConditionRenderProps } from "./deployment-condition-props";
import { ColumnConditionRender } from "../../filter/ColumnConditionRender";

export const NameConditionRender: React.FC<
  DeploymentConditionRenderProps<NameCondition>
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
