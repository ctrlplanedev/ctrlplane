"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconBolt, IconTag } from "@tabler/icons-react";

import {
  Command,
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
                  <CommandItem key={system.id}>{system.name}</CommandItem>
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
                      >
                        <CommandItem>{resource.name}</CommandItem>
                      </Link>
                    ))}

                    {(resources.data?.total ?? 0) > 5 && (
                      <CommandItem disabled>. . .</CommandItem>
                    )}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
              <CommandGroup heading="Settings">
                <CommandItem>Profile</CommandItem>
                <CommandItem>Billing</CommandItem>
                <CommandItem>Settings</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
