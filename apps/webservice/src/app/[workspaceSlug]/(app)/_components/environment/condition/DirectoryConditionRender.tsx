import type { ColumnOperatorType } from "@ctrlplane/validators/conditions";
import type { DirectoryCondition } from "@ctrlplane/validators/environments";

import { ColumnConditionRender } from "../../filter/ColumnConditionRender";
import type { EnvironmentConditionRenderProps } from "./environment-condition-props";

export const DirectoryConditionRender: React.FC<
  EnvironmentConditionRenderProps<DirectoryCondition>
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
      title="Directory"
    />
  );
};
