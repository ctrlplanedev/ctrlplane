import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import React from "react";

import {
  isComparisonCondition,
  isCreatedAtCondition,
  isMetadataCondition,
  isVersionCondition,
} from "@ctrlplane/validators/releases";

import type { ReleaseConditionRenderProps } from "./release-condition-props";
import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { CreatedAtConditionRender } from "./ReleaseCreatedAtConditionRender";
import { ReleaseMetadataConditionRender } from "./ReleaseMetadataConditionRender";
import { ReleaseVersionConditionRender } from "./ReleaseVersionConditionRender";

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const ReleaseConditionRender: React.FC<
  ReleaseConditionRenderProps<DeploymentVersionCondition>
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
      <ReleaseMetadataConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isCreatedAtCondition(condition))
    return (
      <CreatedAtConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isVersionCondition(condition))
    return (
      <ReleaseVersionConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  return null;
};
