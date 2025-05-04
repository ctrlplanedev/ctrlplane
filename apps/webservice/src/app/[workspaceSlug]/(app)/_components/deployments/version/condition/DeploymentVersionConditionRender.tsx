import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import React from "react";

import {
  isComparisonCondition,
  isCreatedAtCondition,
  isMetadataCondition,
  isTagCondition,
  isVersionCondition,
} from "@ctrlplane/validators/releases";

import type { DeploymentVersionConditionRenderProps } from "./deployment-version-condition-props";
import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { DeploymentVersionCreatedAtConditionRender } from "./DeploymentVersionCreatedAtConditionRender";
import { DeploymentVersionMetadataConditionRender } from "./DeploymentVersionMetadataConditionRender";
import { DeploymentVersionTagConditionRender } from "./DeploymentVersionTagConditionRender";

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const DeploymentVersionConditionRender: React.FC<
  DeploymentVersionConditionRenderProps<DeploymentVersionCondition>
> = ({ condition, onChange, onRemove, depth = 0, className }) => {
  if (isComparisonCondition(condition))
    return (
      <ComparisonConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        onRemove={onRemove}
        className={className}
      />
    );

  if (isMetadataCondition(condition))
    return (
      <DeploymentVersionMetadataConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isCreatedAtCondition(condition))
    return (
      <DeploymentVersionCreatedAtConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isVersionCondition(condition) || isTagCondition(condition))
    return (
      <DeploymentVersionTagConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  return null;
};
