import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import {
  IconAlertTriangle,
  IconDots,
  IconPin,
  IconPinnedOff,
  IconSwitch,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { TableCell } from "@ctrlplane/ui/table";

import type { ReleaseTarget } from "../types";
import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/OverrideJobStatusDialog";
import { api } from "~/trpc/react";
import { ForceDeployVersion } from "./ForceDeployVersion";
import { PinVersionDialog, UnpinVersionDialog } from "./VersionPinning";

export const VersionDropdown: React.FC<{
  releaseTarget: ReleaseTarget;
  deploymentVersion: schema.DeploymentVersion;
  job?: schema.Job;
}> = ({ releaseTarget, deploymentVersion, job }) => {
  const utils = api.useUtils();
  const releaseTargetId = releaseTarget.id;
  const invalidate = () =>
    utils.releaseTarget.version.list.invalidate({ releaseTargetId });

  const isVersionPinned =
    releaseTarget.desiredVersionId === deploymentVersion.id;

  return (
    <TableCell className="w-26 flex h-[49px] items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
            <IconDots className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          {isVersionPinned && (
            <UnpinVersionDialog
              releaseTarget={releaseTarget}
              currentPinnedVersion={deploymentVersion}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2"
              >
                <IconPinnedOff className="h-4 w-4" />
                Unpin version
              </DropdownMenuItem>
            </UnpinVersionDialog>
          )}
          {!isVersionPinned && (
            <PinVersionDialog
              releaseTarget={releaseTarget}
              deploymentVersion={deploymentVersion}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2"
              >
                <IconPin className="h-4 w-4" />
                Pin version
              </DropdownMenuItem>
            </PinVersionDialog>
          )}
          {job != null && (
            <OverrideJobStatusDialog
              jobs={[job]}
              enableStatusFilter={false}
              onClose={invalidate}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="flex items-center gap-2"
              >
                <IconSwitch className="h-4 w-4" />
                Override status
              </DropdownMenuItem>
            </OverrideJobStatusDialog>
          )}
          <ForceDeployVersion
            releaseTarget={releaseTarget}
            deploymentVersion={deploymentVersion}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconAlertTriangle className="h-4 w-4" /> Force deploy
            </DropdownMenuItem>
          </ForceDeployVersion>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  );
};
