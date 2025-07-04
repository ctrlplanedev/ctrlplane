import type * as SCHEMA from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconClock,
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
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import {
  ForceDeployReleaseTargetsDialog,
  RedeployReleaseTargetsDialog,
} from "./RedeployReleaseTargets";

const useHasRolloutPolicy = (environmentId: string, versionId: string) => {
  const { data: policyEvaluations } = api.policy.evaluate.environment.useQuery({
    environmentId,
    versionId,
  });

  const hasRolloutPolicy = policyEvaluations?.policies.some(
    (p) => p.environmentVersionRollout != null,
  );

  return hasRolloutPolicy;
};

const RolloutDropdownAction: React.FC<{
  environment: { id: string };
  version: { id: string };
}> = ({ environment, version }) => {
  const hasRolloutPolicy = useHasRolloutPolicy(environment.id, version.id);

  const { workspaceSlug, systemSlug, deploymentSlug, releaseId } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    releaseId: string;
  }>();

  if (!hasRolloutPolicy)
    return (
      <DropdownMenuItem className="flex items-center gap-2" disabled>
        <IconClock className="h-4 w-4" /> Rollout
      </DropdownMenuItem>
    );

  const rolloutUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentSlug)
    .release(releaseId)
    .environment(environment.id);

  return (
    <Link href={rolloutUrl}>
      <DropdownMenuItem className="flex items-center gap-2">
        <IconClock className="h-4 w-4" /> Rollout
      </DropdownMenuItem>
    </Link>
  );
};

type EnvironmentRowDropdownProps = {
  jobs: { id: string; status: SCHEMA.Job["status"] }[];
  deployment: { id: string; name: string };
  version: { id: string };
  environment: { id: string; name: string };
  releaseTargets: {
    id: string;
    resource: { id: string; name: string };
    latestJob: { id: string; status: JobStatus };
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
        <RolloutDropdownAction {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
