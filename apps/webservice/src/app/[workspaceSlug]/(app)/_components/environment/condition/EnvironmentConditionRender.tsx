import type {
  EnvironmentCondition} from "@ctrlplane/validators/environments";
import {
  isComparisonCondition,
  isDirectoryCondition,
  isIdCondition,
  isNameCondition,
  isSystemCondition,
} from "@ctrlplane/validators/environments";

import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { DirectoryConditionRender } from "./DirectoryConditionRender";
import type { EnvironmentConditionRenderProps } from "./environment-condition-props";
import { IdConditionRender } from "./IdConditionRender";
import { NameConditionRender } from "./NameConditionRender";
import { SystemConditionRender } from "./SystemConditionRender";

export const EnvironmentConditionRender: React.FC<
  EnvironmentConditionRenderProps<EnvironmentCondition>
> = ({ condition, onChange, className, depth = 0 }) => {
  if (isComparisonCondition(condition))
    return (
      <ComparisonConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isNameCondition(condition))
    return (
      <NameConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isSystemCondition(condition))
    return (
      <SystemConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isIdCondition(condition))
    return (
      <IdConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isDirectoryCondition(condition))
    return (
      <DirectoryConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  return null;
};
