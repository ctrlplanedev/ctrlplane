"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LZString from "lz-string";

import { Badge } from "@ctrlplane/ui/badge";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
} from "@ctrlplane/ui/sidebar";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { ResourceIcon } from "~/app/[workspaceSlug]/(appv2)/_components/resources/ResourceIcon";
import { api } from "~/trpc/react";

export const SidebarGroupKinds: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const pathname = usePathname();
  const kinds = api.workspace.resourceKinds.useQuery(workspace.id);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Types</SidebarGroupLabel>
      <SidebarMenu>
        {kinds.data?.length === 0 && (
          <div className="rounded  border-neutral-800 px-2 text-xs text-muted-foreground text-neutral-700">
            No resources found
          </div>
        )}
        {kinds.data?.map(({ version, kind, count }) => {
          const url = `/${workspace.slug}/resources/list?filter=${LZString.compressToEncodedURIComponent(
            JSON.stringify({
              type: FilterType.Comparison,
              operator: ComparisonOperator.And,
              conditions: [
                {
                  type: ResourceFilterType.Kind,
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
              <Link href={url}>
                <ResourceIcon version={version} kind={kind} />
                <span className="flex-grow">{kind}</span>
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
      </SidebarMenu>
    </SidebarGroup>
  );
};
