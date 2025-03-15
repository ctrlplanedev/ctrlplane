"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconBolt, IconCategory, IconObjectScan, IconSettings, IconTag } from "@tabler/icons-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@ctrlplane/ui/command";
import { Dialog, DialogContent, DialogTrigger } from "@ctrlplane/ui/dialog";
import { ColumnOperator } from "@ctrlplane/validators/conditions";

import { api } from "~/trpc/react";

export const SearchDialog: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [search, setSearch] = useState("");
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const systems = api.system.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess },
  );
  const resources = api.resource.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? "",
      filter:
        search != ""
          ? {
              type: "comparison",
              operator: "or",
              conditions: [
                {
                  type: "name",
                  operator: ColumnOperator.Contains,
                  value: search,
                },
              ],
            }
          : undefined,
    },
    {
      enabled: workspace.isSuccess && workspace.data?.id !== "",
      placeholderData: (prev) => prev,
    },
  );

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="overflow-hidden p-0">
          <Command shouldFilter={false}>
            <CommandInput value={search} onValueChange={setSearch} />
            <CommandList className="max-h-[75vh]">
              <CommandEmpty>No results found.</CommandEmpty>

              {search.length === 0 && (
                <>
                  <CommandGroup heading="Actions">
                    <CommandItem className="text-sm">
                      <IconBolt className="mr-2 w-4" /> {search} Trigger Runbook
                    </CommandItem>
                    <CommandItem>
                      <IconTag className="mr-2 w-4" />
                      New Release
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              <CommandGroup heading="Systems">
                {systems.data?.items.map((system) => (
                  <Link
                    key={system.id}
                    href={`/${workspaceSlug}/systems/${system.slug}`}
                    className="block w-full"
                  >
                    <CommandItem className="flex items-center">
                      <div className="mr-2 rounded-full bg-primary/10 p-1">
                        <IconCategory className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{system.name}</div>
                        <div className="text-xs text-muted-foreground">System</div>
                      </div>
                    </CommandItem>
                  </Link>
                ))}
              </CommandGroup>

              {resources.data?.total !== 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Resources">
                    {resources.data?.items.slice(0, 5).map((resource) => (
                      <Link
                        key={resource.id}
                        href={`/${workspaceSlug}/resources/${resource.id}`}
                        className="block w-full"
                      >
                        <CommandItem className="flex items-center">
                          <div className="mr-2 rounded-full bg-blue-500/10 p-1">
                            <IconObjectScan className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <div className="font-medium">{resource.name}</div>
                            <div className="text-xs text-muted-foreground">{resource.kind} • {resource.identifier}</div>
                          </div>
                        </CommandItem>
                      </Link>
                    ))}

                    {(resources.data?.total ?? 0) > 5 && (
                      <CommandItem className="text-center text-sm text-muted-foreground">
                        + {(resources.data?.total ?? 0) - 5} more resources
                      </CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup heading="Settings">
                <Link
                  href={`/${workspaceSlug}/_settings/account/profile`}
                  className="block w-full"
                >
                  <CommandItem className="flex items-center">
                    <div className="mr-2 rounded-full bg-secondary p-1">
                      <IconSettings className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <span>Profile</span>
                  </CommandItem>
                </Link>
                <Link
                  href={`/${workspaceSlug}/_settings/workspace/billing`}
                  className="block w-full"
                >
                  <CommandItem className="flex items-center">
                    <div className="mr-2 rounded-full bg-secondary p-1">
                      <IconSettings className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <span>Billing</span>
                  </CommandItem>
                </Link>
                <Link
                  href={`/${workspaceSlug}/_settings/workspace`}
                  className="block w-full"
                >
                  <CommandItem className="flex items-center">
                    <div className="mr-2 rounded-full bg-secondary p-1">
                      <IconSettings className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <span>Settings</span>
                  </CommandItem>
                </Link>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
