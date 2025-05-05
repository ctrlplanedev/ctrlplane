"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { ResourceConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionDialog";
import { ResourceList } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceList";
import { api } from "~/trpc/react";

export const EditSelector: React.FC<{
  environment: SCHEMA.Environment;
  resources: SCHEMA.Resource[];
}> = ({ environment, resources }) => {
  const updateEnvironment = api.environment.update.useMutation();
  const router = useRouter();

  const onChange = (resourceCondition: ResourceCondition | null) =>
    updateEnvironment
      .mutateAsync({
        id: environment.id,
        data: { resourceSelector: resourceCondition ?? undefined },
      })
      .then(() => router.refresh());

  return (
    <ResourceConditionDialog
      condition={environment.resourceSelector}
      onChange={onChange}
      ResourceList={({ filter }) => (
        <ResourceList
          filter={filter}
          ResourceDiff={({ newResources }) => {
            const addedResources = newResources.filter(
              (r) => !resources.some((c) => c.id === r.id),
            );

            const removedResources = resources.filter(
              (r) => !newResources.some((c) => c.id === r.id),
            );

            return (
              <div className="text-xs">
                {addedResources.length > 0 && (
                  <div className="text-green-400">
                    +{addedResources.length} new resources
                  </div>
                )}
                {removedResources.length > 0 && (
                  <div className="text-red-400">
                    -{removedResources.length} resources
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
    >
      <Button size="sm" variant="outline">
        Edit Selector
      </Button>
    </ResourceConditionDialog>
  );
};
