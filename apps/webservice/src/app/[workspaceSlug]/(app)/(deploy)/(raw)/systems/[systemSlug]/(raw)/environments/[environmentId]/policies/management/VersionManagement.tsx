"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { IconLoader2 } from "@tabler/icons-react";

import { Label } from "@ctrlplane/ui/label";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";

import { useUpdatePolicy } from "../useUpdatePolicy";

type VersionManagementProps = {
  environmentPolicy: RouterOutputs["environment"]["policy"]["byEnvironmentId"];
};

export const VersionManagement: React.FC<VersionManagementProps> = ({
  environmentPolicy,
}) => {
  const { releaseSequencing } = environmentPolicy;

  const { onUpdate, isPending } = useUpdatePolicy(environmentPolicy.id);

  return (
    <div className="space-y-10 p-2">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          Version Management
          {isPending && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          )}
        </h1>
        <span className="text-sm text-muted-foreground">
          Version management policies are concerned with how new and existing
          versions are handled within the deployment pipeline. These include
          defining sequencing rules, such as whether to cancel or await pending
          jobs when a new version is created, ensuring that deployments happen
          in a controlled and predictable manner without conflicts or
          disruptions.
        </span>
      </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <Label>Job Sequencing</Label>
          <div className="text-sm text-muted-foreground">
            Specify whether pending jobs should be cancelled or awaited when a
            new version is created.
          </div>
        </div>
        <RadioGroup
          value={releaseSequencing}
          onValueChange={(releaseSequencing: "wait" | "cancel") =>
            onUpdate({ releaseSequencing })
          }
        >
          <div className="flex items-center space-x-3 space-y-0">
            <RadioGroupItem value="wait" id="release-sequencing-wait" />
            <Label htmlFor="release-sequencing-wait">Keep pending jobs</Label>
          </div>
          <div className="flex items-center space-x-3 space-y-0">
            <RadioGroupItem value="cancel" id="release-sequencing-cancel" />
            <Label htmlFor="release-sequencing-cancel">
              Cancel pending jobs
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
