import { useState } from "react";
import { Filter } from "lucide-react";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeploymentId } from "../hooks";

function useDeploymentsSearch() {
  const { workspace } = useWorkspace();

  const { data, isLoading } = trpc.deployment.list.useQuery({
    workspaceId: workspace.id,
  });

  return { deployments: data?.items ?? [], isLoading };
}

export function DeploymentFilter() {
  const [open, setOpen] = useState(false);

  const { deployments } = useDeploymentsSearch();
  const { deploymentId, setDeploymentId } = useDeploymentId();

  const selectedDeployment = deployments.find(
    (d) => d.deployment.id === deploymentId,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-48 items-center justify-start gap-2 px-2"
        >
          <Filter className="size-4" />
          <span className="truncate">
            {selectedDeployment?.deployment.name ?? "All deployments"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0">
        <Command>
          <CommandInput placeholder="Search deployments..." />
          <CommandList>
            <CommandItem value="all" onSelect={() => setDeploymentId("all")}>
              All deployments
            </CommandItem>
            {deployments.map((deployment) => (
              <CommandItem
                key={deployment.deployment.id}
                value={`${deployment.deployment.name} (${deployment.deployment.id})`}
                onSelect={() => setDeploymentId(deployment.deployment.id)}
              >
                {deployment.deployment.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
