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
import { useResourceDrawer } from "./useResourceDrawer";

type DeleteResourceDialogProps = {
  resourceId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const DeleteResourceDialog: React.FC<DeleteResourceDialogProps> = ({
  resourceId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const deleteResource = api.resource.delete.useMutation();
  const { removeResourceId } = useResourceDrawer();
  const utils = api.useUtils();
  const router = useRouter();

  const handleDelete = () =>
    deleteResource
      .mutateAsync([resourceId])
      .then(() => removeResourceId())
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
          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this resource?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className={buttonVariants({ variant: "destructive" })}
            disabled={deleteResource.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type RedeployResourceDialogProps = {
  resourceId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const RedeployResourceDialog: React.FC<RedeployResourceDialogProps> = ({
  resourceId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const redeployResource = api.resource.redeploy.useMutation();

  const onRedeploy = () =>
    redeployResource.mutateAsync(resourceId).then(() => setOpen(false));

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
          <AlertDialogTitle>Redeploy Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to redeploy this resource? This will redeploy
            the latest release across all systems and environments for this
            resource.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRedeploy}
            className={buttonVariants({ variant: "default" })}
            disabled={redeployResource.isPending}
          >
            Redeploy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type ResourceActionsDropdownProps = {
  resource: SCHEMA.Resource;
  children: React.ReactNode;
};

export const ResourceActionsDropdown: React.FC<
  ResourceActionsDropdownProps
> = ({ resource, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <RedeployResourceDialog
          resourceId={resource.id}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconRefresh className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployResourceDialog>
        <DeleteResourceDialog
          resourceId={resource.id}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-destructive" />
            Delete
          </DropdownMenuItem>
        </DeleteResourceDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
