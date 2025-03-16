import type { JobCondition } from "@ctrlplane/validators/jobs";
import React from "react";

import {
  isComparisonCondition,
  isCreatedAtCondition,
  isMetadataCondition,
  isStatusCondition,
} from "@ctrlplane/validators/jobs";

import type { JobConditionRenderProps } from "./job-condition-props";
import { JobCreatedAtConditionRender } from "./JobCreatedAtConditionRender";
import { JobMetadataConditionRender } from "./JobMetadataConditionRender";
import { RunbookJobComparisonConditionRender } from "./RunbookJobComparisonConditionRender";
import { StatusConditionRender } from "./StatusConditionRender";

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const RunbookJobConditionRender: React.FC<
  JobConditionRenderProps<JobCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  if (isComparisonCondition(condition))
    return (
      <RunbookJobComparisonConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isCreatedAtCondition(condition))
    return (
      <JobCreatedAtConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isMetadataCondition(condition))
    return (
      <JobMetadataConditionRender
        condition={condition}
        onChange={onChange}
        depth={depth}
        className={className}
      />
    );

  if (isStatusCondition(condition))
    return (
      <StatusConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  return null;
};
