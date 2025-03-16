import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconTrash } from "@tabler/icons-react";

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

type DeleteDeploymentVersionChannelDialogProps = {
  deploymentVersionChannelId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const DeleteDeploymentVersionChannelDialog: React.FC<
  DeleteDeploymentVersionChannelDialogProps
> = ({ deploymentVersionChannelId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const deleteParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("release_channel_id");
    url.searchParams.delete("release_channel_id_filter");
    url.searchParams.delete("filter");
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const deleteDeploymentVersionChannel =
    api.deployment.version.channel.delete.useMutation();
  const onDelete = () =>
    deleteDeploymentVersionChannel
      .mutateAsync(deploymentVersionChannelId)
      .then(() => deleteParams())
      .then(() => router.refresh())
      .then(() => setOpen(false));

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
          <AlertDialogTitle>
            Are you sure you want to delete this release channel?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            onClick={onDelete}
            disabled={deleteDeploymentVersionChannel.isPending}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type DeploymentVersionChannelDropdownProps = {
  deploymentVersionChannelId: string;
  children: React.ReactNode;
};

export const DeploymentVersionChannelDropdown: React.FC<
  DeploymentVersionChannelDropdownProps
> = ({ deploymentVersionChannelId, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DeleteDeploymentVersionChannelDialog
          deploymentVersionChannelId={deploymentVersionChannelId}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DeleteDeploymentVersionChannelDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
