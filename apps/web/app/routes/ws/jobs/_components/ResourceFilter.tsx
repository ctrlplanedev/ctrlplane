import { useState } from "react";
import { Filter } from "lucide-react";
import { useDebounce } from "react-use";

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
import { useResourceId } from "../hooks";

function useResourcesSearch() {
  const { workspace } = useWorkspace();

  const [cel, setCel] = useState("");
  const [celDebounced, setCelDebounced] = useState(cel);
  useDebounce(() => setCelDebounced(cel), 1000, [cel]);

  const { data, isLoading } = trpc.resource.list.useQuery({
    workspaceId: workspace.id,
    selector: {
      cel: `resource.name.contains('${celDebounced}') || resource.identifier.contains('${celDebounced}')`,
    },
    limit: 20,
    offset: 0,
  });

  return { resources: data?.items ?? [], isLoading, cel, setCel };
}

export function ResourceFilter() {
  const [open, setOpen] = useState(false);

  const { resources, cel, setCel } = useResourcesSearch();
  const { resourceId, setResourceId } = useResourceId();

  const selectedResource = resources.find((r) => r.id === resourceId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-48 items-center justify-start gap-2 px-2"
        >
          <Filter className="size-4" />
          <span className="truncate">
            {selectedResource?.name ?? "All resources"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search resources..."
            value={cel}
            onValueChange={setCel}
          />
          <CommandList>
            <CommandItem value="all" onSelect={() => setResourceId("all")}>
              All resources
            </CommandItem>
            {resources.map((resource) => (
              <CommandItem
                key={resource.id}
                value={resource.id}
                onSelect={() => setResourceId(resource.id)}
              >
                {resource.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
