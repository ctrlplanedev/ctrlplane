"use client";

import { IconLoader2, IconShip } from "@tabler/icons-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@ctrlplane/ui/drawer";

import { api } from "~/trpc/react";
import { ReleaseTable } from "./ReleaseTable";
import { useDeploymentEnvResourceDrawer } from "./useDeploymentResourceDrawer";

export const DeploymentResourceDrawer: React.FC = () => {
  const {
    deploymentId,
    environmentId,
    resourceId,
    setDeploymentEnvResourceId,
  } = useDeploymentEnvResourceDrawer();
  const isOpen =
    deploymentId != null && environmentId != null && resourceId != null;
  const setIsOpen = () => setDeploymentEnvResourceId(null, null, null);

  const { data: deployment, ...deploymentQ } = api.deployment.byId.useQuery(
    deploymentId ?? "",
    { enabled: isOpen },
  );

  const { data: resource, ...resourceQ } = api.resource.byId.useQuery(
    resourceId ?? "",
    { enabled: isOpen },
  );

  const { data: environment, ...environmentQ } = api.environment.byId.useQuery(
    environmentId ?? "",
    { enabled: isOpen },
  );

  const { data: releaseWithTriggersData, ...releaseWithTriggersQ } =
    api.job.config.byDeploymentEnvAndResource.useQuery(
      {
        deploymentId: deploymentId ?? "",
        environmentId: environmentId ?? "",
        resourceId: resourceId ?? "",
      },
      { enabled: isOpen, refetchInterval: 5_000 },
    );
  const releaseWithTriggers = releaseWithTriggersData ?? [];

  const loading =
    deploymentQ.isLoading ||
    resourceQ.isLoading ||
    environmentQ.isLoading ||
    releaseWithTriggersQ.isLoading;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 left-auto right-0 top-0 mt-0 h-screen w-2/3 max-w-7xl overflow-auto rounded-none focus-visible:outline-none"
      >
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
            {/*
              Drawer component throws an error if the title and description are not present, so just render empty elements.
              Technically shadcn recommends using the VisuallyHidden radix component, but this fixes without any additional dependencies.
             */}
            <DrawerTitle />
            <DrawerDescription />
          </div>
        )}
        {!loading &&
          deployment != null &&
          resource != null &&
          environment != null && (
            <>
              <DrawerTitle className="flex flex-col gap-2 border-b p-6">
                <div className="flex items-center gap-2">
                  <div className="flex-shrink-0 rounded bg-amber-500/20 p-1 text-amber-400">
                    <IconShip className="h-4 w-4" />
                  </div>
                  {deployment.name}
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>Resource: {resource.name}</span>
                  <span>Environment: {environment.name}</span>
                </div>
              </DrawerTitle>

              <div className="flex flex-col gap-4 p-6">
                <ReleaseTable
                  releasesWithTriggers={releaseWithTriggers}
                  environment={environment}
                  deployment={deployment}
                  resource={resource}
                />
              </div>
            </>
          )}
      </DrawerContent>
    </Drawer>
  );
};
