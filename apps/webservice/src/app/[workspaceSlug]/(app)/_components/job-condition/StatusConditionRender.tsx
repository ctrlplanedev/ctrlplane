import type {
  JobStatusType,
  StatusCondition,
} from "@ctrlplane/validators/jobs";
import type React from "react";

import { JobStatus, JobStatusReadable } from "@ctrlplane/validators/jobs";

import type { JobConditionRenderProps } from "./job-condition-props";
import { ChoiceConditionRender } from "../filter/ChoiceConditionRender";

export const StatusConditionRender: React.FC<
  JobConditionRenderProps<StatusCondition>
> = ({ condition, onChange, className }) => {
  const options = Object.entries(JobStatus).map(([key, value]) => ({
    key,
    value,
    display: JobStatusReadable[value],
  }));

  const setStatus = (status: string) =>
    onChange({ ...condition, value: status as JobStatusType });

  const selectedStatus = options.find(
    (option) => option.value === condition.value,
  );

  return (
    <ChoiceConditionRender
      type="status"
      onSelect={setStatus}
      selected={selectedStatus?.display ?? null}
      options={options}
      className={className}
    />
  );
};
