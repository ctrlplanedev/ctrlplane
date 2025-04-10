import type { ColumnOperatorType } from "@ctrlplane/validators/conditions";
import type { SlugCondition } from "@ctrlplane/validators/deployments";

import type { DeploymentConditionRenderProps } from "./deployment-condition-props";
import { ColumnConditionRender } from "../../filter/ColumnConditionRender";

export const SlugConditionRender: React.FC<
  DeploymentConditionRenderProps<SlugCondition>
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
