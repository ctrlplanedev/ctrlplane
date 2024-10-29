import type { ColumnOperatorType } from "@ctrlplane/validators/conditions";
import type { IdentifierCondition } from "@ctrlplane/validators/targets";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { ColumnConditionRender } from "../filter/ColumnConditionRender";

export const IdentifierConditionRender: React.FC<
  TargetConditionRenderProps<IdentifierCondition>
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
      title="Identifier"
    />
  );
};
