import type {
  ColumnOperatorType,
  VersionCondition,
} from "@ctrlplane/validators/conditions";

import type { JobConditionRenderProps } from "./job-condition-props";
import { ColumnConditionRender } from "../filter/ColumnConditionRender";

export const JobReleaseVersionConditionRender: React.FC<
  JobConditionRenderProps<VersionCondition>
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
      title="Release version"
    />
  );
};
