import type {
  VersionCondition,
  VersionOperatorType,
} from "@ctrlplane/validators/conditions";

import type { JobConditionRenderProps } from "./job-condition-props";
import { VersionConditionRender } from "../filter/VersionConditionRender";

export const JobReleaseVersionConditionRender: React.FC<
  JobConditionRenderProps<VersionCondition>
> = ({ condition, onChange, className }) => {
  const setOperator = (operator: VersionOperatorType) =>
    onChange({ ...condition, operator });
  const setValue = (value: string) => onChange({ ...condition, value });

  return (
    <VersionConditionRender
      operator={condition.operator}
      value={condition.value}
      setOperator={setOperator}
      setValue={setValue}
      className={className}
      title="Release version"
    />
  );
};
