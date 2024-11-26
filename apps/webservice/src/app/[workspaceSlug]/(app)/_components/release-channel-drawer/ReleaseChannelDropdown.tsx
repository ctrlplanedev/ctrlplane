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
import { useQueryParams } from "../useQueryParams";

type DeleteReleaseChannelDialogProps = {
  releaseChannelId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const DeleteReleaseChannelDialog: React.FC<DeleteReleaseChannelDialogProps> = ({
  releaseChannelId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const { setParams } = useQueryParams();
  const router = useRouter();
  const deleteReleaseChannel =
    api.deployment.releaseChannel.delete.useMutation();
  const onDelete = () =>
    deleteReleaseChannel
      .mutateAsync(releaseChannelId)
      .then(() =>
        // setting params one at a time does not work and only makes one change
        // so we directly set all params to null at once
        setParams({
          "release-channel-id": null,
          release_channel_id: null,
          filter: null,
        }),
      )
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
            disabled={deleteReleaseChannel.isPending}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type ReleaseChannelDropdownProps = {
  releaseChannelId: string;
  children: React.ReactNode;
};

export const ReleaseChannelDropdown: React.FC<ReleaseChannelDropdownProps> = ({
  releaseChannelId,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DeleteReleaseChannelDialog
          releaseChannelId={releaseChannelId}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            Delete
          </DropdownMenuItem>
        </DeleteReleaseChannelDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
