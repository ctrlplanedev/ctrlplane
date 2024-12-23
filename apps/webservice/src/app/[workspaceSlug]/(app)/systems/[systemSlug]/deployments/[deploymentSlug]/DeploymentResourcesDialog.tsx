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

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resource-condition/ResourceConditionRender";
import { ResourceList } from "~/app/[workspaceSlug]/(app)/_components/resource-condition/ResourceList";
import { api } from "~/trpc/react";

type Environment = {
  id: string;
  name: string;
  resourceFilter: ResourceCondition;
};
type DeploymentResourcesDialogProps = {
  environments: Environment[];
  resourceFilter: ResourceCondition;
  workspaceId: string;
};

export const DeploymentResourcesDialog: React.FC<
  DeploymentResourcesDialogProps
> = ({ environments, resourceFilter, workspaceId }) => {
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<Environment | null>(environments[0] ?? null);

  const filter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [selectedEnvironment?.resourceFilter, resourceFilter].filter(
      isPresent,
    ),
  };

  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId, filter, limit: 5 },
    { enabled: selectedEnvironment != null },
  );

  const resources = data?.items ?? [];
  const count = data?.total ?? 0;

  if (environments.length === 0) return null;
  return (
    <Dialog>
      <DialogTrigger>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          disabled={!isValidResourceCondition(resourceFilter)}
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
