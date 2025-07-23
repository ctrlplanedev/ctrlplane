import type * as schema from "@ctrlplane/db/schema";
import { useState } from "react";
import {
  IconAlertTriangle,
  IconDots,
  IconRefresh,
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
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { RedeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/RedeployVersionDialog";

const OverrideJobStatusAction: React.FC<{
  job: schema.Job;
  onClose: () => void;
}> = ({ job, onClose }) => (
  <OverrideJobStatusDialog
    jobs={[job]}
    onClose={onClose}
    enableStatusFilter={false}
  >
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer items-center gap-2"
    >
      <IconSwitch className="h-4 w-4" />
      Override status
    </DropdownMenuItem>
  </OverrideJobStatusDialog>
);

const RedeployAction: React.FC<{
  deployment: schema.Deployment;
  environment: schema.Environment;
  resource: schema.Resource;
}> = (props) => (
  <RedeployVersionDialog {...props}>
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer items-center gap-2"
    >
      <IconRefresh className="h-4 w-4" />
      Redeploy
    </DropdownMenuItem>
  </RedeployVersionDialog>
);

const ForceDeployAction: React.FC<{
  deployment: schema.Deployment;
  environment: schema.Environment;
  resource: schema.Resource;
}> = (props) => (
  <ForceDeployVersionDialog {...props}>
    <DropdownMenuItem
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer items-center gap-2"
    >
      <IconAlertTriangle className="h-4 w-4" />
      Force deploy
    </DropdownMenuItem>
  </ForceDeployVersionDialog>
);

type JobRowDropdownProps = {
  job: schema.Job;
  releaseTarget: {
    deployment: schema.Deployment;
    environment: schema.Environment;
    resource: schema.Resource;
  };
};

export const JobRowDropdown: React.FC<JobRowDropdownProps> = ({
  job,
  releaseTarget,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <OverrideJobStatusAction job={job} onClose={() => setOpen(false)} />
        <RedeployAction {...releaseTarget} />
        <ForceDeployAction {...releaseTarget} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
