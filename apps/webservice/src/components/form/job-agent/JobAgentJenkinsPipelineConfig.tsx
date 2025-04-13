"use client";

import { Button } from "@ctrlplane/ui/button";
import { FormDescription, FormItem, FormLabel } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

interface JobAgentJenkinsPipelineConfigProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  disabled?: boolean;
  isPending?: boolean;
}

export const JobAgentJenkinsPipelineConfig: React.FC<
  JobAgentJenkinsPipelineConfigProps
> = ({ value, onChange, disabled, isPending }) => {
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
          value={value.jobUrl ?? ""}
          onChange={handleJobUrlChange}
          disabled={disabled}
        />
        <FormDescription>
          The URL path to the Jenkins job (format: {"{JENKINS_URL}"}
          /job/org/job/repo/job/branch)
        </FormDescription>
      </FormItem>

      <div className="flex">
        <Button type="submit" disabled={disabled ?? isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};
