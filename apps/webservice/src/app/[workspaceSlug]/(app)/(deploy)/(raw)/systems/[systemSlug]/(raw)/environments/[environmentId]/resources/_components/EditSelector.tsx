"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { ResourceConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionDialog";
import { api } from "~/trpc/react";

export const EditSelector: React.FC<{
  environment: SCHEMA.Environment;
}> = ({ environment }) => {
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
      showResourceList
    >
      <Button size="sm" variant="outline">
        Edit Selector
      </Button>
    </ResourceConditionDialog>
  );
};
