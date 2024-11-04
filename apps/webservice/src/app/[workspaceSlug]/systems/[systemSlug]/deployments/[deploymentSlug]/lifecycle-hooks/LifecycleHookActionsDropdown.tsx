import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
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

type DeleteLifecycleHookDialogProps = {
  lifecycleHookId: string;
  onClose: () => void;
  children: React.ReactNode;
};

const DeleteLifecycleHookDialog: React.FC<DeleteLifecycleHookDialogProps> = ({
  lifecycleHookId,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deleteLifecycleHook = api.deployment.lifecycleHook.delete.useMutation();

  const onDelete = async () =>
    deleteLifecycleHook
      .mutateAsync(lifecycleHookId)
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
          <AlertDialogTitle>Delete Lifecycle Hook?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={onDelete}
            disabled={deleteLifecycleHook.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type LifecycleHookActionsDropdownProps = {
  lifecycleHook: SCHEMA.DeploymentLifecycleHook;
  children: React.ReactNode;
};

export const LifecycleHookActionsDropdown: React.FC<
  LifecycleHookActionsDropdownProps
> = ({ lifecycleHook, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DeleteLifecycleHookDialog
          lifecycleHookId={lifecycleHook.id}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex items-center gap-2"
            onSelect={(e) => e.preventDefault()}
          >
            Delete
            <IconTrash size="icon" className="h-4 w-4 text-destructive" />
          </DropdownMenuItem>
        </DeleteLifecycleHookDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
