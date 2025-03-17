"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconDotsVertical, IconReload } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";
import { activeStatus, JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type ResourceDeploymentMenuProps = {
  deploymentId: string;
  deploymentName: string;
  versionId?: string;
  versionTag?: string;
  environmentId: string;
  jobStatus?: JobStatus | null;
};

export const ResourceDeploymentMenu: React.FC<ResourceDeploymentMenuProps> = ({
  deploymentId,
  deploymentName,
  versionId,
  versionTag,
  environmentId,
  jobStatus,
}) => {
  const { resourceId } = useParams<{ resourceId: string }>();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const redeploy = api.deployment.version.deploy.toResource.useMutation({
    onSuccess: () => {
      router.refresh();
      setDialogOpen(false);
    },
  });

  const isActive = jobStatus ? activeStatus.includes(jobStatus) : false;

  // No actions available without a version
  if (versionId == null) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <IconDotsVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {isActive ? (
          <HoverCard>
            <HoverCardTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="space-x-2 text-muted-foreground hover:cursor-not-allowed focus:bg-transparent focus:text-muted-foreground"
              >
                <IconReload className="h-4 w-4" />
                <span>Redeploy</span>
              </DropdownMenuItem>
            </HoverCardTrigger>
            <HoverCardContent className="p-1 text-sm">
              Cannot redeploy while job is in progress
            </HoverCardContent>
          </HoverCard>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="space-x-2"
              >
                <IconReload className="h-4 w-4" />
                <span>Redeploy</span>
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
              <DialogHeader>
                <DialogTitle>
                  Redeploy {deploymentName} {versionTag}
                </DialogTitle>
                <DialogDescription>
                  This will redeploy the version to this resource.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <Button
                  disabled={redeploy.isPending}
                  onClick={() =>
                    redeploy.mutate({
                      versionId,
                      resourceId,
                      environmentId,
                    })
                  }
                >
                  Redeploy
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
