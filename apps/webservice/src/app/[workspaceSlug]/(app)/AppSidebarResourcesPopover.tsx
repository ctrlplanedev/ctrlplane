"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBookmark } from "@tabler/icons-react";
import LZString from "lz-string";

import { Badge } from "@ctrlplane/ui/badge";
import { SidebarMenuButton } from "@ctrlplane/ui/sidebar";
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
    <div className="space-y-4 text-sm">
      <div className="text-lg font-semibold">Targets</div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Saved Views
        </div>
        <div>
          <div className="rounded-md text-xs text-neutral-600">
            No saved filters found.
          </div>
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
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Kinds
        </div>
        <div>
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
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Recently Added Targets
        </div>
        <div>
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
          {totalTargets > 0 && (
            <div className="mt-2 px-1 text-xs text-muted-foreground">
              +{totalTargets} other targets
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
