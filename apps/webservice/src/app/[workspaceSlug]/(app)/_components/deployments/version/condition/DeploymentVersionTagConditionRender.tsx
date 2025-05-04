import type {
  ColumnOperatorType,
  VersionCondition,
} from "@ctrlplane/validators/conditions";
import type { TagCondition } from "@ctrlplane/validators/releases";
import React from "react";

import type { DeploymentVersionConditionRenderProps } from "./deployment-version-condition-props";
import { ColumnConditionRender } from "~/app/[workspaceSlug]/(app)/_components/filter/ColumnConditionRender";

export const DeploymentVersionTagConditionRender: React.FC<
  DeploymentVersionConditionRenderProps<VersionCondition | TagCondition>
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
      title="Tag"
    />
  );
};
