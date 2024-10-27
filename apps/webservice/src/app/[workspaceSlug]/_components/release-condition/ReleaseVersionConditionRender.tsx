import type {
  VersionCondition,
  VersionOperatorType,
} from "@ctrlplane/validators/conditions";
import React from "react";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { VersionConditionRender } from "../filter/VersionConditionRender";

export const ReleaseVersionConditionRender: React.FC<
  ReleaseConditionRenderProps<VersionCondition>
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
    />
  );
};
