"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import { IconLoader2 } from "@tabler/icons-react";

import { Drawer, DrawerContent } from "@ctrlplane/ui/drawer";

import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { api } from "~/trpc/react";
import { useResourceDrawer } from "./useResourceDrawer";

type ResourceInformation = NonNullable<RouterOutputs["resource"]["byId"]>;

const ResourceDrawerHeader: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4">
        <ResourceIcon
          version={resource.version}
          kind={resource.kind}
          className="h-10 w-10"
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{resource.name}</span>
          <span className="text-xs text-muted-foreground">
            {resource.version}:{resource.kind}
          </span>
        </div>
      </div>
    </div>
  );
};

const ResourceDrawerContent: React.FC<{
  resource: ResourceInformation;
}> = ({ resource }) => {
  return (
    <div className="flex flex-col gap-4">
      <ResourceDrawerHeader resource={resource} />
    </div>
  );
};

export const ResourceDrawer: React.FC = () => {
  const { resourceId, removeResourceId } = useResourceDrawer();
  const isOpen = resourceId != null && resourceId != "";
  const setIsOpen = removeResourceId;

  const { data, isLoading } = api.resource.byId.useQuery(resourceId ?? "", {
    enabled: isOpen,
  });

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent showBar={false}>
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {data != null && <ResourceDrawerContent resource={data} />}
      </DrawerContent>
    </Drawer>
  );
};
