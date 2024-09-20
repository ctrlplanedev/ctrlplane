"use client";

import type {
  TargetProvider,
  TargetProviderGoogle,
} from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TbDots } from "react-icons/tb";

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
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { UpdateGoogleProviderDialog } from "./integrations/google/UpdateGoogleProviderDialog";

type Provider = TargetProvider & {
  googleConfig: TargetProviderGoogle | null;
};

export const ProviderActionsDropdown: React.FC<{
  provider: Provider;
}> = ({ provider }) => {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const deleteProvider = api.target.provider.delete.useMutation({
    onSuccess: () => utils.target.provider.byWorkspaceId.invalidate(),
  });
  const router = useRouter();

  const handleDelete = async (deleteTargets: boolean) => {
    await deleteProvider.mutateAsync({
      providerId: provider.id,
      deleteTargets,
    });
    router.refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <TbDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {provider.googleConfig != null && (
          <UpdateGoogleProviderDialog
            providerId={provider.id}
            name={provider.name}
            projectIds={provider.googleConfig.projectIds}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit
            </DropdownMenuItem>
          </UpdateGoogleProviderDialog>
        )}
        <AlertDialog onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                <p className="mb-2">You have two options for deletion:</p>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>
                    <strong>Delete only the provider:</strong> This will set the
                    provider field of its targets to null. The first provider to
                    add a target with the same identifier will become the new
                    owner.
                  </li>
                  <li>
                    <strong>Delete both the provider and its targets:</strong>{" "}
                    This action is irreversible and will permanently remove the
                    provider along with all associated targets.
                  </li>
                </ol>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                onClick={() => handleDelete(false)}
              >
                Delete Provider
              </AlertDialogAction>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                onClick={() => handleDelete(true)}
              >
                Delete Provider and Targets
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
