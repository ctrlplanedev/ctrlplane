import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import React, { useState } from "react";
import {
  IconAlertTriangle,
  IconDots,
  IconReload,
  IconSwitch,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/OverrideJobStatusDialog";
import { api } from "~/trpc/react";
import {
  ForceDeployReleaseTargetsDialog,
  RedeployReleaseTargetsDialog,
} from "./RedeployReleaseTargets";

type EnvironmentRowDropdownProps = {
  jobs: { id: string; status: SCHEMA.Job["status"] }[];
  deployment: { id: string; name: string };
  version: { id: string };
  environment: { id: string; name: string };
  releaseTargets: {
    id: string;
    resource: { id: string; name: string };
    latestJob?: { id: string; status: JobStatus };
  }[];
};

export const EnvironmentRowDropdown: React.FC<EnvironmentRowDropdownProps> = (
  props,
) => {
  const [open, setOpen] = useState(false);
  const { jobs } = props;
  const utils = api.useUtils();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <RedeployReleaseTargetsDialog {...props} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconReload className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployReleaseTargetsDialog>
        <ForceDeployReleaseTargetsDialog
          {...props}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconAlertTriangle className="h-4 w-4" />
            Force deploy
          </DropdownMenuItem>
        </ForceDeployReleaseTargetsDialog>
        <OverrideJobStatusDialog
          jobs={jobs}
          onClose={() => utils.deployment.version.job.list.invalidate()}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconSwitch className="h-4 w-4" />
            Override status
          </DropdownMenuItem>
        </OverrideJobStatusDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
