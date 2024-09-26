import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";

import {
  isComparisonCondition,
  isKindCondition,
  isMetadataCondition,
  isNameLikeCondition,
} from "@ctrlplane/validators/targets";

import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { KindConditionRender } from "./KindConditionRender";
import { MetadataConditionRender } from "./MetadataConditionRender";
import { NameConditionRender } from "./NameConditionRender";

type TargetConditionRenderProps<T extends TargetCondition> = {
  condition: T;
  onChange: (condition: T) => void;
  onRemove?: () => void;
  depth?: number;
  className?: string;
};

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const TargetConditionRender: React.FC<
  TargetConditionRenderProps<TargetCondition>
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
      <MetadataConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isKindCondition(condition))
    return (
      <KindConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (isNameLikeCondition(condition))
    return (
      <NameConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  return null;
};
