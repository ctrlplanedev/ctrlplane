import type { DeploymentCondition } from "@ctrlplane/validators/deployments";

import {
  isComparisonCondition,
  isIdCondition,
  isNameCondition,
  isSlugCondition,
  isSystemCondition,
} from "@ctrlplane/validators/deployments";

import type { DeploymentConditionRenderProps } from "./deployment-condition-props";
import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { IdConditionRender } from "./IdConditionRender";
import { NameConditionRender } from "./NameConditionRender";
import { SlugConditionRender } from "./SlugConditionRender";
import { SystemConditionRender } from "./SystemConditionRender";

export const DeploymentConditionRender: React.FC<
  DeploymentConditionRenderProps<DeploymentCondition>
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

  if (isSlugCondition(condition))
    return (
      <SlugConditionRender
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

  return null;
};
