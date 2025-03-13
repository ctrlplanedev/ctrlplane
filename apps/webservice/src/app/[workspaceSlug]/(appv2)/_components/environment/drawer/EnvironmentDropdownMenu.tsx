import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
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
import { useEnvironmentDrawer } from "./EnvironmentDrawer";

const DeleteEnvironmentDialog: React.FC<{
  environment: SCHEMA.Environment;
  children: React.ReactNode;
  onClose: () => void;
}> = ({ environment, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const deleteEnvironment = api.environment.delete.useMutation();
  const utils = api.useUtils();
  const { removeEnvironmentId } = useEnvironmentDrawer();

  const onDelete = () =>
    deleteEnvironment
      .mutateAsync(environment.id)
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(() => removeEnvironmentId())
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
          <AlertDialogTitle>Delete Environment</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this environment? You will have to
          recreate it from scratch.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type EnvironmentDropdownMenuProps = {
  environment: SCHEMA.Environment;
  children: React.ReactNode;
};

export const EnvironmentDropdownMenu: React.FC<
  EnvironmentDropdownMenuProps
> = ({ environment, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DeleteEnvironmentDialog
          environment={environment}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconTrash className="h-4 w-4 text-red-500" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DeleteEnvironmentDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
