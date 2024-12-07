import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconRefresh, IconTrash } from "@tabler/icons-react";

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
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { useTargetDrawer } from "./useTargetDrawer";

type DeleteTargetDialogProps = {
  targetId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const DeleteTargetDialog: React.FC<DeleteTargetDialogProps> = ({
  targetId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const deleteTarget = api.resource.delete.useMutation();
  const { removeTargetId } = useTargetDrawer();
  const utils = api.useUtils();
  const router = useRouter();

  const handleDelete = () =>
    deleteTarget
      .mutateAsync([targetId])
      .then(() => removeTargetId())
      .then(() => utils.resource.byWorkspaceId.list.invalidate())
      .then(() => router.refresh())
      .then(() => onClose());

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Target</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this target?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className={buttonVariants({ variant: "destructive" })}
            disabled={deleteTarget.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type RedeployTargetDialogProps = {
  targetId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const RedeployTargetDialog: React.FC<RedeployTargetDialogProps> = ({
  targetId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const redeployTarget = api.resource.redeploy.useMutation();

  const onRedeploy = () =>
    redeployTarget.mutateAsync(targetId).then(() => setOpen(false));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redeploy Target</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to redeploy this target? This will redeploy
            the latest release across all systems and environments for this
            target.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRedeploy}
            className={buttonVariants({ variant: "default" })}
            disabled={redeployTarget.isPending}
          >
            Redeploy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type TargetActionsDropdownProps = {
  target: SCHEMA.Resource;
  children: React.ReactNode;
};

export const TargetActionsDropdown: React.FC<TargetActionsDropdownProps> = ({
  target,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <RedeployTargetDialog
          targetId={target.id}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconRefresh className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployTargetDialog>
        <DeleteTargetDialog targetId={target.id} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-destructive" />
            Delete
          </DropdownMenuItem>
        </DeleteTargetDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
