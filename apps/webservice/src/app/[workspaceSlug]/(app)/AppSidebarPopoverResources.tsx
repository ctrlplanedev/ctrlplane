"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBookmark } from "@tabler/icons-react";
import LZString from "lz-string";

import { Badge } from "@ctrlplane/ui/badge";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
} from "@ctrlplane/ui/sidebar";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";
import { TargetIcon } from "./_components/TargetIcon";
import { useSidebarPopover } from "./AppSidebarPopoverContext";

export const AppSidebarResourcesPopover: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const { setActiveSidebarItem } = useSidebarPopover();
  const pathname = usePathname();
  const kinds = api.workspace.resourceKinds.useQuery(workspace.id);

  const views = api.resource.view.list.useQuery(workspace.id);
  const viewsWithHash = views.data?.map((view) => ({
    ...view,
    hash: LZString.compressToEncodedURIComponent(JSON.stringify(view.filter)),
  }));

  const recentlyAdded = api.resource.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    orderBy: [{ property: "createdAt", direction: "desc" }],
    limit: 5,
  });

  const totalTargets =
    (recentlyAdded.data?.total ?? 0) - (recentlyAdded.data?.items.length ?? 0);

  return (
    <>
      <SidebarHeader className="mt-1 px-3">Resources</SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Saved Views</SidebarGroupLabel>
          <SidebarMenu>
            {views.data?.length === 0 && views.isSuccess && (
              <div className="rounded-md px-2 text-xs text-neutral-600">
                No saved filters found.
              </div>
            )}
            {viewsWithHash != null && viewsWithHash.length > 0 && (
              <>
                {viewsWithHash.map(({ id, name, hash }) => (
                  <SidebarMenuButton asChild key={id}>
                    <Link
                      href={`/${workspace.slug}/targets?filter=${hash}`}
                      onClick={() => setActiveSidebarItem(null)}
                    >
                      <IconBookmark className="h-4 w-4 text-muted-foreground" />
                      {name}
                    </Link>
                  </SidebarMenuButton>
                ))}
              </>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Kinds</SidebarGroupLabel>
          <SidebarMenu>
            {kinds.data?.map(({ version, kind, count }) => {
              const url = `/${workspace.slug}/targets?filter=${LZString.compressToEncodedURIComponent(
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
                  <Link href={url} onClick={() => setActiveSidebarItem(null)}>
                    <TargetIcon version={version} kind={kind} />
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

        <SidebarGroup>
          <SidebarGroupLabel>Recently Added</SidebarGroupLabel>
          <SidebarMenu>
            {recentlyAdded.data?.items.map((resource) => (
              <SidebarMenuButton
                asChild
                key={resource.id}
                isActive={pathname.includes(`?target_id=${resource.id}`)}
              >
                <Link
                  href={`${pathname}?target_id=${resource.id}`}
                  onClick={() => setActiveSidebarItem(null)}
                >
                  <TargetIcon version={resource.version} kind={resource.kind} />
                  <span className="flex-grow">{resource.name}</span>
                </Link>
              </SidebarMenuButton>
            ))}

            <SidebarMenuButton
              asChild
              className="pl-2 text-[0.02em] text-muted-foreground"
            >
              <Link
                href={`/${workspace.slug}/targets`}
                onClick={() => setActiveSidebarItem(null)}
              >
                View {totalTargets} other targets
              </Link>
            </SidebarMenuButton>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
};