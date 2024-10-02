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

import { EditTargetViewDialog } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionDialog";
import { api } from "~/trpc/react";
import { useTargetFilter } from "./useTargetFilter";

const DeleteTargetViewDialog: React.FC<{
  viewId: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ viewId, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const deleteTargetView = api.target.view.delete.useMutation();
  const { removeView } = useTargetFilter();

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
              deleteTargetView
                .mutateAsync(viewId)
                .then(removeView)
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

export const TargetViewActionsDropdown: React.FC<{
  view: schema.TargetView;
  children: React.ReactNode;
}> = ({ view, children }) => {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isTargetPage = pathname.includes("/targets");
  const { setView } = useTargetFilter();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuGroup>
          <EditTargetViewDialog
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
          </EditTargetViewDialog>
          <DeleteTargetViewDialog
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
          </DeleteTargetViewDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
