"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconReload,
} from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
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

import { api } from "~/trpc/react";

const RedeployReleaseDialog: React.FC<{
  release: { id: string; name: string };
  environment: { id: string; name: string };
  children: React.ReactNode;
}> = ({ release, environment, children }) => {
  const router = useRouter();
  const redeploy = api.release.deploy.toEnvironment.useMutation();

  const [isOpen, setIsOpen] = useState(false);
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Redeploy{" "}
            <Badge variant="secondary" className="h-7 text-lg">
              {release.name}
            </Badge>{" "}
            to {environment.name}?
          </DialogTitle>
          <DialogDescription>
            This will redeploy the release to all resources in the environment.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            disabled={redeploy.isPending}
            onClick={() =>
              redeploy
                .mutateAsync({
                  environmentId: environment.id,
                  releaseId: release.id,
                })
                .then(() => {
                  setIsOpen(false);
                  router.refresh();
                })
            }
          >
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ForceReleaseDialog: React.FC<{
  release: { id: string; name: string };
  environment: { id: string; name: string };
  children: React.ReactNode;
}> = ({ release, environment, children }) => {
  const forceDeploy = api.release.deploy.toEnvironment.useMutation();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Force release {release.name} to {environment.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will force the release to be deployed to all resources in the
            environment regardless of any policies set on the environment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() =>
              forceDeploy
                .mutateAsync({
                  environmentId: environment.id,
                  releaseId: release.id,
                  isForcedRelease: true,
                })
                .then(() => router.refresh())
            }
          >
            Force deploy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const RedeployReleaseButton: React.FC<{
  release: { id: string; name: string };
  environment: { id: string; name: string };
  isReleaseActive: boolean;
}> = ({ release, environment, isReleaseActive }) =>
  isReleaseActive ? (
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
        Cannot redeploy a release that is active
      </HoverCardContent>
    </HoverCard>
  ) : (
    <RedeployReleaseDialog release={release} environment={environment}>
      <DropdownMenuItem
        onSelect={(e) => e.preventDefault()}
        className="space-x-2"
      >
        <IconReload className="h-4 w-4" />
        <span>Redeploy</span>
      </DropdownMenuItem>
    </RedeployReleaseDialog>
  );

export const ReleaseDropdownMenu: React.FC<{
  release: { id: string; name: string };
  environment: { id: string; name: string };
  isReleaseActive: boolean;
}> = ({ release, environment, isReleaseActive }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
      >
        <IconDotsVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <RedeployReleaseButton
        release={release}
        environment={environment}
        isReleaseActive={isReleaseActive}
      />
      <ForceReleaseDialog release={release} environment={environment}>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="space-x-2"
        >
          <IconAlertTriangle className="h-4 w-4" />
          <span>Force deploy</span>
        </DropdownMenuItem>
      </ForceReleaseDialog>
    </DropdownMenuContent>
  </DropdownMenu>
);
