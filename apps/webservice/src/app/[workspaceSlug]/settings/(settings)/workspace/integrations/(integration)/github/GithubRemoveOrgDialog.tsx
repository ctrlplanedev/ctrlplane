"use client";

import type {
  Deployment,
  GithubConfigFile,
  GithubOrganization,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

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
import { Badge } from "@ctrlplane/ui/badge";
import { buttonVariants } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

type GithubConfigFileWithDeployments = GithubConfigFile & {
  deployments: Deployment[];
};

export type GithubOrganizationWithConfigFiles = GithubOrganization & {
  configFiles: GithubConfigFileWithDeployments[];
};

type GithubRemoveOrgDialogProps = {
  githubOrganization: GithubOrganizationWithConfigFiles;
  children: React.ReactNode;
};

export const GithubRemoveOrgDialog: React.FC<GithubRemoveOrgDialogProps> = ({
  githubOrganization,
  children,
}) => {
  const router = useRouter();
  const githubOrgDelete = api.github.organizations.delete.useMutation();

  const handleDelete = (deleteResources: boolean) => {
    githubOrgDelete
      .mutateAsync({
        id: githubOrganization.id,
        workspaceId: githubOrganization.workspaceId,
        deleteDeployments: deleteResources,
      })
      .then(() => router.refresh());
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          {githubOrganization.configFiles.length > 0 ? (
            <AlertDialogDescription>
              <p className="mb-2">You have two options for deletion:</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  <strong>Disconnect only the organization:</strong> Any
                  resources generated from a{" "}
                  <Badge variant="secondary">
                    <code>ctrlplane.yaml</code>
                  </Badge>{" "}
                  config file associated with this organization will remain, but
                  will no longer be synced with changes to the source file.
                </li>
                <li>
                  <strong>Disconnect and delete all resources:</strong> This
                  action is irreversible and will permanently remove the
                  organization along with all associated resources. This
                  includes all resources generated from a{" "}
                  <Badge variant="secondary">
                    <code>ctrlplane.yaml</code>
                  </Badge>{" "}
                  config file in a repo within your Github organization.
                </li>
              </ol>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription>
              Disconnecting the organization will remove the connection between
              Ctrlplane and your Github organization for this workspace.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => handleDelete(false)}
          >
            Disconnect {githubOrganization.configFiles.length > 0 && "only"}
          </AlertDialogAction>
          {githubOrganization.configFiles.length > 0 && (
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => handleDelete(true)}
            >
              Disconnect and delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
