"use client";

import { FormDescription, FormItem, FormLabel } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

interface JobAgentJenkinsPipelineConfigProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  disabled?: boolean;
}

export const JobAgentJenkinsPipelineConfig: React.FC<
  JobAgentJenkinsPipelineConfigProps
> = ({ value = {}, onChange, disabled = false }) => {
  const handleJobUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      jobUrl: e.target.value,
    });
  };

  return (
    <div className="space-y-4">
      <FormItem>
        <FormLabel>Jenkins Job URL</FormLabel>
        <Input
          placeholder="e.g. http://jenkins/job/org/job/repo/job/branch"
          value={value.jobUrl || ""}
          onChange={handleJobUrlChange}
          disabled={disabled}
        />
        <FormDescription>
          The URL path to the Jenkins job (format:
          http://jenkins/job/org/job/repo/job/branch)
        </FormDescription>
      </FormItem>
    </div>
  );
};
