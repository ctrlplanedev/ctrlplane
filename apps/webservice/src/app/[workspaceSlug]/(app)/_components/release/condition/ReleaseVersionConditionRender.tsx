import type {
  ColumnOperatorType,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import React from "react";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { ColumnConditionRender } from "~/app/[workspaceSlug]/(app)/_components/filter/ColumnConditionRender";

export const ReleaseVersionConditionRender: React.FC<
  ReleaseConditionRenderProps<VersionCondition>
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
      title="Version"
    />
  );
};
