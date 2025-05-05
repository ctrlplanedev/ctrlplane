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
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { isValidResourceCondition } from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import { ResourceList } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceList";

type Environment = {
  id: string;
  name: string;
  resourceSelector: ResourceCondition;
};
type DeploymentResourcesDialogProps = {
  environments: Environment[];
  resourceSelector: ResourceCondition;
};

export const DeploymentResourcesDialog: React.FC<
  DeploymentResourcesDialogProps
> = ({ environments, resourceSelector }) => {
  const [selectedEnvironment, setSelectedEnvironment] =
    useState<Environment | null>(environments[0] ?? null);

  const condition: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [
      selectedEnvironment?.resourceSelector,
      resourceSelector,
    ].filter(isPresent),
  };

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
            environment and deployment selector.
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
            <ResourceConditionRender
              condition={condition}
              onChange={() => {}}
            />
            <ResourceList filter={condition} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
