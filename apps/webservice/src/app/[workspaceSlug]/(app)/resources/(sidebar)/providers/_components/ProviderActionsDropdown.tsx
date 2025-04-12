"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconDotsVertical } from "@tabler/icons-react";

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
import { UpdateAwsProviderDialog } from "../integrations/aws/UpdateAwsProviderDialog";
import { UpdateAzureProviderDialog } from "../integrations/azure/UpdateAzureProviderDialog";
import { UpdateGoogleProviderDialog } from "../integrations/google/UpdateGoogleProviderDialog";

export const ProviderActionsDropdown: React.FC<{
  providerId: string;
}> = ({ providerId }) => {
  const [open, setOpen] = useState(false);
  const utils = api.useUtils();
  const { data: provider } = api.resource.provider.byId.useQuery(providerId);
  const isManagedProvider =
    provider?.googleConfig != null ||
    provider?.awsConfig != null ||
    provider?.azureConfig != null;

  const deleteProvider = api.resource.provider.delete.useMutation({
    onSuccess: () => utils.resource.provider.byWorkspaceId.invalidate(),
  });
  const sync = api.resource.provider.managed.sync.useMutation();
  const router = useRouter();

  if (provider == null)
    return (
      <Button variant="ghost" className="h-5 w-5 p-0" disabled>
        <span className="sr-only">Open menu</span>
        <IconDotsVertical className="h-3 w-3" />
      </Button>
    );

  const handleDelete = async (deleteResources: boolean) => {
    await deleteProvider.mutateAsync({
      providerId: provider.id,
      deleteResources,
    });
    router.refresh();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-5 w-5 p-0">
          <span className="sr-only">Open menu</span>
          <IconDotsVertical className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {provider.googleConfig != null && (
          <UpdateGoogleProviderDialog
            providerId={provider.id}
            name={provider.name}
            googleConfig={provider.googleConfig}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit
            </DropdownMenuItem>
          </UpdateGoogleProviderDialog>
        )}
        {provider.awsConfig != null && (
          <UpdateAwsProviderDialog
            providerId={provider.id}
            name={provider.name}
            awsConfig={provider.awsConfig}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit
            </DropdownMenuItem>
          </UpdateAwsProviderDialog>
        )}
        {provider.azureConfig != null && (
          <UpdateAzureProviderDialog
            workspaceId={provider.workspaceId}
            resourceProvider={provider}
            azureConfig={provider.azureConfig}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit
            </DropdownMenuItem>
          </UpdateAzureProviderDialog>
        )}
        {isManagedProvider && (
          <DropdownMenuItem
            onSelect={async () => {
              await sync.mutateAsync(provider.id);
              router.refresh();
            }}
          >
            Sync
          </DropdownMenuItem>
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
                    provider field of its resources to null. The first provider
                    to add a resource with the same identifier will become the
                    new owner.
                  </li>
                  <li>
                    <strong>Delete both the provider and its resources:</strong>{" "}
                    This action is irreversible and will permanently remove the
                    provider along with all associated resources.
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
                Delete Provider and Resources
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
