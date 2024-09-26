import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";

import {
  ComparisonConditionRender,
  conditionIsComparison,
} from "./ComparisonConditionRender";
import { conditionIsKind, KindConditionRender } from "./KindConditionRender";
import {
  conditionIsMetadata,
  MetadataConditionRender,
} from "./MetadataConditionRender";
import { conditionIsName, NameConditionRender } from "./NameConditionRender";

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
  console.log({ depth });

  if (conditionIsComparison(condition))
    return (
      <ComparisonConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        onRemove={onRemove}
        className={className}
      />
    );

  if (conditionIsMetadata(condition))
    return (
      <MetadataConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (conditionIsKind(condition))
    return (
      <KindConditionRender
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
        depth={depth}
        className={className}
      />
    );

  if (conditionIsName(condition))
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
