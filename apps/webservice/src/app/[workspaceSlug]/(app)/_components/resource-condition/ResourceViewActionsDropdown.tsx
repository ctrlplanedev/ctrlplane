import type * as schema from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { IconPencil, IconTrash } from "@tabler/icons-react";

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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { EditResourceViewDialog } from "./ResourceConditionDialog";
import { useResourceFilter } from "./useResourceFilter";

const DeleteResourceViewDialog: React.FC<{
  viewId: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ viewId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const deleteResourceView = api.resource.view.delete.useMutation();
  const { setFilter } = useResourceFilter();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this view?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Deleting this view will remove it for everyone in the workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() =>
              deleteResourceView
                .mutateAsync(viewId)
                .then(() => setFilter(null, null))
                .then(onClose)
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const ResourceViewActionsDropdown: React.FC<{
  view: schema.ResourceView;
  children: React.ReactNode;
}> = ({ view, children }) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isTargetPage = pathname.includes("/targets");
  const { setFilter } = useResourceFilter();
  const setView = (v: schema.ResourceView) => setFilter(v.filter, v.id);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuGroup>
          <EditResourceViewDialog
            view={view}
            onClose={() => setOpen(false)}
            onSubmit={isTargetPage ? setView : undefined}
          >
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconPencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </EditResourceViewDialog>
          <DeleteResourceViewDialog
            viewId={view.id}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              className="flex items-center gap-2"
              onSelect={(e) => e.preventDefault()}
            >
              <IconTrash className="h-4 w-4 text-red-400" />
              Delete
            </DropdownMenuItem>
          </DeleteResourceViewDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
