import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useState } from "react";
import { IconFilter } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { isValidResourceCondition } from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceConditionRender";
import { ResourceList } from "~/app/[workspaceSlug]/(appv2)/_components/resources/condition/ResourceList";
import { api } from "~/trpc/react";

type Environment = {
  id: string;
  name: string;
  resourceSelector: ResourceCondition;
};
type DeploymentResourcesDialogProps = {
  environments: Environment[];
  resourceSelector: ResourceCondition;
  workspaceId: string;
};

export const DeploymentResourcesDialog: React.FC<
  DeploymentResourcesDialogProps
> = ({ environments, resourceSelector, workspaceId }) => {
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<Environment | null>(environments[0] ?? null);

  const filter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [
      selectedEnvironment?.resourceSelector,
      resourceSelector,
    ].filter(isPresent),
  };
  const isFilterValid = isValidResourceCondition(filter);

  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter, limit: 5 },
    { enabled: selectedEnvironment != null && isFilterValid },
  );

  const resources = data?.items ?? [];
  const count = data?.total ?? 0;

  if (environments.length === 0) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          type="button"
          disabled={!isValidResourceCondition(resourceSelector)}
        >
          <IconFilter className="h-4 w-4" /> View Resources
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[1000px] space-y-6">
        <DialogHeader>
          <DialogTitle>View Resources</DialogTitle>
          <DialogDescription>
            Select an environment to view the resources based on the combined
            environment and deployment filter.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={selectedEnvironment?.id}
          onValueChange={(value) => {
            const environment = environments.find((e) => e.id === value);
            setSelectedEnvironment(environment ?? null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an environment" />
          </SelectTrigger>
          <SelectContent>
            {environments.map((environment) => (
              <SelectItem key={environment.id} value={environment.id}>
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedEnvironment != null && (
          <>
            <ResourceConditionRender condition={filter} onChange={() => {}} />
            {!isLoading && (
              <ResourceList
                resources={resources}
                count={count}
                filter={filter}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
