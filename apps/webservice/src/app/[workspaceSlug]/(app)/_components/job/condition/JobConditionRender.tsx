import type { JobCondition } from "@ctrlplane/validators/jobs";
import React from "react";

import {
  isComparisonCondition,
  isCreatedAtCondition,
  isDeploymentCondition,
  isEnvironmentCondition,
  isJobResourceCondition,
  isMetadataCondition,
  isStatusCondition,
  isVersionCondition,
} from "@ctrlplane/validators/jobs";

import type { JobConditionRenderProps } from "./job-condition-props";
import { DeploymentConditionRender } from "./DeploymentConditionRender";
import { EnvironmentConditionRender } from "./EnvironmentConditionRender";
import { JobComparisonConditionRender } from "./JobComparisonConditionRender";
import { JobCreatedAtConditionRender } from "./JobCreatedAtConditionRender";
import { JobMetadataConditionRender } from "./JobMetadataConditionRender";
import { JobResourceConditionRender } from "./JobResourceConditionRender";
import { StatusConditionRender } from "./StatusConditionRender";
import { JobReleaseVersionConditionRender } from "./VersionConditionRender";

/**
 * The parent container should have min width of 1000px
 * to render this component properly.
 */
export const JobConditionRender: React.FC<
  JobConditionRenderProps<JobCondition>
> = ({ condition, onChange, depth = 0, className }) => {
  if (isComparisonCondition(condition))
    return (
      <JobComparisonConditionRender
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

  if (isDeploymentCondition(condition))
    return (
      <DeploymentConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isEnvironmentCondition(condition))
    return (
      <EnvironmentConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isVersionCondition(condition))
    return (
      <JobReleaseVersionConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );

  if (isJobResourceCondition(condition))
    return (
      <JobResourceConditionRender
        condition={condition}
        onChange={onChange}
        className={className}
      />
    );
  return null;
};
