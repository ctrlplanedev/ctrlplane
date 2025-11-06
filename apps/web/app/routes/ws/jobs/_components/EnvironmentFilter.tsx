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
import { useEnvironmentId } from "../hooks";

function useEnvironmentsSearch() {
  const { workspace } = useWorkspace();

  const { data, isLoading } = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  return { environments: data?.items ?? [], isLoading };
}

export function EnvironmentFilter() {
  const [open, setOpen] = useState(false);

  const { environments, isLoading } = useEnvironmentsSearch();
  const { environmentId, setEnvironmentId } = useEnvironmentId();

  const selectedEnvironment = environments.find((e) => e.id === environmentId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-40 items-center justify-start gap-2 px-2"
        >
          <Filter className="size-4" />
          <span className="truncate">
            {selectedEnvironment?.name ?? "All environments"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-0">
        <Command>
          <CommandInput placeholder="Search environments..." />
          <CommandList>
            <CommandItem value="all" onSelect={() => setEnvironmentId("all")}>
              All environments
            </CommandItem>
            {environments.map((environment) => (
              <CommandItem
                key={environment.id}
                value={`${environment.name} (${environment.id})`}
                onSelect={() => setEnvironmentId(environment.id)}
              >
                {environment.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
