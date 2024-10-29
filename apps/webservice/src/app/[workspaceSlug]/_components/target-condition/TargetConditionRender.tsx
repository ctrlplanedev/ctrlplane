import type { TargetCondition } from "@ctrlplane/validators/targets";
import React from "react";

import {
  isComparisonCondition,
  isIdentifierCondition,
  isKindCondition,
  isMetadataCondition,
  isNameCondition,
  isProviderCondition,
} from "@ctrlplane/validators/targets";

import type { TargetConditionRenderProps } from "./target-condition-props";
import { ComparisonConditionRender } from "./ComparisonConditionRender";
import { IdentifierConditionRender } from "./IdentifierConditionRender";
import { KindConditionRender } from "./KindConditionRender";
import { NameConditionRender } from "./NameConditionRender";
import { ProviderConditionRender } from "./ProviderConditionRender";
import { TargetMetadataConditionRender } from "./TargetMetadataConditionRender";

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const TargetConditionRender: React.FC<
  TargetConditionRenderProps<TargetCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  if (isComparisonCondition(condition))
    return (
      <ComparisonConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isMetadataCondition(condition))
    return (
      <TargetMetadataConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isKindCondition(condition))
    return (
      <KindConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isNameCondition(condition))
    return (
      <NameConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isProviderCondition(condition))
    return (
      <ProviderConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isIdentifierCondition(condition))
    return (
      <IdentifierConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  return null;
};
