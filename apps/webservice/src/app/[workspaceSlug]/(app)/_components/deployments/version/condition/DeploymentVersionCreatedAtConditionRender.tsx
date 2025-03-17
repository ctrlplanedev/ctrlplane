import type {
  CreatedAtCondition,
  DateOperatorType,
} from "@ctrlplane/validators/conditions";

import type { DeploymentVersionConditionRenderProps } from "./deployment-version-condition-props";
import { DateConditionRender } from "~/app/[workspaceSlug]/(app)/_components/filter/DateConditionRender";

export const DeploymentVersionCreatedAtConditionRender: React.FC<
  DeploymentVersionConditionRenderProps<CreatedAtCondition>
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
