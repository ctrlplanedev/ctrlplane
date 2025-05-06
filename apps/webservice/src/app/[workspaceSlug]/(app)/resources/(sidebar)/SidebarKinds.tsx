"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import _ from "lodash";
import LZString from "lz-string";

import { Badge } from "@ctrlplane/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ctrlplane/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@ctrlplane/ui/sidebar";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import { ResourceIcon } from "~/app/[workspaceSlug]/(app)/_components/resources/ResourceIcon";
import { api } from "~/trpc/react";

export const SidebarGroupKinds: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const pathname = usePathname();
  const kinds = api.workspace.resourceKinds.useQuery(workspace.id);

  const kindsByVersion = _.groupBy(kinds.data, (k) => k.version);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Types</SidebarGroupLabel>
      <SidebarMenu>
        {kinds.data?.length === 0 && (
          <div className="rounded border-neutral-800 px-2 text-xs text-muted-foreground text-neutral-700">
            No resources found
          </div>
        )}
        {Object.entries(kindsByVersion).map(([version, versionKinds]) => (
          <Collapsible key={version}>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-neutral-800">
              <IconChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
              <span className="overflow-hidden text-ellipsis text-nowrap">
                {version}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {versionKinds.map(({ kind, count }) => {
                const url = `/${workspace.slug}/resources/list?condition=${LZString.compressToEncodedURIComponent(
                  JSON.stringify({
                    type: ConditionType.Comparison,
                    operator: ComparisonOperator.And,
                    conditions: [
                      {
                        type: ResourceConditionType.Kind,
                        value: kind,
                        operator: "equals",
                      },
                    ],
                  }),
                )}`;
                return (
                  <SidebarMenuButton
                    asChild
                    key={`${version}/${kind}`}
                    isActive={pathname.includes(url)}
                  >
                    <Link href={url} className="pl-6">
                      <ResourceIcon version={version} kind={kind} />
                      <span className="w-36 truncate">{kind}</span>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-neutral-500/10 text-xs text-muted-foreground"
                      >
                        {count}
                      </Badge>
                    </Link>
                  </SidebarMenuButton>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
