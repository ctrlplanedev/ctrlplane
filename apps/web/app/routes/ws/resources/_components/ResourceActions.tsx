import { useState } from "react";
import { EllipsisIcon, Trash } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
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
} from "~/components/ui/alert-dialog";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useResource } from "./ResourceProvider";

function useDeleteResource() {
  const { workspace } = useWorkspace();
  const { resource } = useResource();
  const navigate = useNavigate();

  const { mutateAsync, isPending } = trpc.resource.delete.useMutation();

  const handleDelete = () =>
    mutateAsync({
      workspaceId: workspace.id,
      identifier: resource.identifier,
    })
      .then(() => toast.success("Resource deletion queued successfully"))
      .then(() => navigate(`/${workspace.slug}/resources`));

  return { handleDelete, isPending };
}

export function DeleteResourceDialog({ onClose }: { onClose: () => void }) {
  const { handleDelete, isPending } = useDeleteResource();
  const onClick = () => handleDelete().then(onClose);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <Trash className="size-4" />
          Delete
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this resource? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onClick}
            disabled={isPending}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResourceActions() {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6">
          <EllipsisIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DeleteResourceDialog onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
