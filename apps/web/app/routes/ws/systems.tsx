import { useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { Link } from "react-router";
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
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateSystemDialog } from "./_components/CreateSystemDialog";

export function meta() {
  return [
    { title: "Systems - Ctrlplane" },
    {
      name: "description",
      content: "Manage your systems",
    },
  ];
}

type DeleteSystemDialogProps = {
  system: { id: string; name: string; workspaceId: string } | null;
  deployments: Array<{
    deployment: { id: string; name: string; systemId: string };
  }>;
  environments: Array<{
    id: string;
    name: string;
    systemId: string;
  }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function DeleteSystemDialog({
  system,
  deployments,
  environments,
  open,
  onOpenChange,
}: DeleteSystemDialogProps) {
  const utils = trpc.useUtils();
  const deleteSystemMutation = trpc.system.delete.useMutation();

  if (!system) return null;

  const systemDeployments = deployments.filter(
    (d) => d.deployment.systemId === system.id,
  );
  const systemEnvironments = environments.filter(
    (e) => e.systemId === system.id,
  );

  const handleDelete = () => {
    deleteSystemMutation
      .mutateAsync({
        workspaceId: system.workspaceId,
        systemId: system.id,
      })
      .then(() => {
        utils.system.list.invalidate({ workspaceId: system.workspaceId });
        utils.deployment.list.invalidate({ workspaceId: system.workspaceId });
        utils.environment.list.invalidate({ workspaceId: system.workspaceId });
        onOpenChange(false);
        toast.success("System deleted successfully");
      })
      .catch((error: unknown) => {
        const message =
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : "Failed to delete system";
        toast.error(message);
      });
  };

  const hasRelatedResources =
    systemDeployments.length > 0 || systemEnvironments.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete System</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete the system{" "}
                <span className="font-semibold text-foreground">
                  {system.name}
                </span>
                ? This action cannot be undone.
              </p>

              {hasRelatedResources && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
                  <p className="mb-3 font-semibold text-destructive">
                    The following resources will also be deleted:
                  </p>

                  <div className="space-y-4">
                    {systemDeployments.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground">
                          Deployments ({systemDeployments.length}):
                        </p>
                        <ul className="space-y-1 pl-4">
                          {systemDeployments.map((d) => (
                            <li
                              key={d.deployment.id}
                              className="text-sm text-muted-foreground"
                            >
                              • {d.deployment.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {systemEnvironments.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground">
                          Environments ({systemEnvironments.length}):
                        </p>
                        <ul className="space-y-1 pl-4">
                          {systemEnvironments.map((e) => (
                            <li
                              key={e.id}
                              className="text-sm text-muted-foreground"
                            >
                              • {e.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSystemMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteSystemMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteSystemMutation.isPending ? "Deleting..." : "Delete System"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function Systems() {
  const { workspace } = useWorkspace();
  const [systemToDelete, setSystemToDelete] = useState<{
    id: string;
    name: string;
    workspaceId: string;
  } | null>(null);

  const { data: systemsData, isLoading: isLoadingSystems } =
    trpc.system.list.useQuery({
      workspaceId: workspace.id,
    });

  const { data: deploymentsData } = trpc.deployment.list.useQuery({
    workspaceId: workspace.id,
  });

  const { data: environmentsData } = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const systems = (systemsData?.items ?? []).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const deployments = deploymentsData?.items ?? [];
  const environments = environmentsData?.items ?? [];

  // Get deployments and environments for a specific system
  const getSystemResources = (systemId: string) => {
    const systemDeployments = deployments
      .filter((d) => d.deployment.systemId === systemId)
      .sort((a, b) => a.deployment.name.localeCompare(b.deployment.name));
    const systemEnvironments = environments
      .filter((e) => e.systemId === systemId)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { systemDeployments, systemEnvironments };
  };

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Systems</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <CreateSystemDialog>
          <Button>Create System</Button>
        </CreateSystemDialog>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Loading State */}
        {isLoadingSystems && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading systems...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Systems List */}
        {!isLoadingSystems && systems.length > 0 && (
          <div className="space-y-2">
            {systems.map((system) => {
              const { systemDeployments, systemEnvironments } =
                getSystemResources(system.id);
              const isDefaultSystem =
                system.id === "00000000-0000-0000-0000-000000000000";
              return (
                <Card key={system.id} className="overflow-hidden p-8">
                  <CardContent className="m-0 p-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* System Header */}
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {system.name}
                          </h3>
                          {isDefaultSystem && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>

                        {/* System Description */}
                        {system.description && (
                          <p className="text-sm text-muted-foreground">
                            {system.description}
                          </p>
                        )}

                        {/* Deployments */}
                        {systemDeployments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Deployments ({systemDeployments.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {systemDeployments.map((d) => (
                                <Link
                                  key={d.deployment.id}
                                  to={`/${workspace.slug}/deployments/${d.deployment.id}`}
                                >
                                  <Badge
                                    variant="secondary"
                                    className="cursor-pointer bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                                  >
                                    {d.deployment.name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Environments */}
                        {systemEnvironments.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Environments ({systemEnvironments.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {systemEnvironments.map((e) => (
                                <Link
                                  key={e.id}
                                  to={`/${workspace.slug}/environments/${e.id}`}
                                >
                                  <Badge
                                    variant="secondary"
                                    className="cursor-pointer bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
                                  >
                                    {e.name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty State for System */}
                        {systemDeployments.length === 0 &&
                          systemEnvironments.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No deployments or environments
                            </p>
                          )}
                      </div>

                      {/* Delete Button */}
                      {!isDefaultSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSystemToDelete({
                              id: system.id,
                              name: system.name,
                              workspaceId: system.workspaceId,
                            });
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoadingSystems && systems.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No systems found</h3>
              <p className="text-center text-sm text-muted-foreground">
                Get started by creating your first system
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <DeleteSystemDialog
        system={systemToDelete}
        deployments={deployments}
        environments={environments}
        open={!!systemToDelete}
        onOpenChange={(open) => {
          if (!open) setSystemToDelete(null);
        }}
      />
    </>
  );
}
