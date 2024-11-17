"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { IconBookmark } from "@tabler/icons-react";
import LZString from "lz-string";

import { Badge } from "@ctrlplane/ui/badge";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";
import { TargetIcon } from "./_components/TargetIcon";
import { SidebarLink } from "./SidebarLink";

export const SidebarPopoverTargets: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  const kinds = api.workspace.resourceKinds.useQuery(workspace.id);

  const views = api.resource.view.list.useQuery(workspace.id);
  const viewsWithHash = views.data?.map((view) => ({
    ...view,
    hash: LZString.compressToEncodedURIComponent(JSON.stringify(view.filter)),
  }));

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
                <SidebarLink
                  href={`/${workspace.slug}/targets?filter=${hash}`}
                  key={id}
                >
                  <IconBookmark className="h-4 w-4 text-muted-foreground" />
                  {name}
                </SidebarLink>
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
          {kinds.data?.map(({ version, kind, count }) => (
            <SidebarLink
              href={`/${workspace.slug}/targets?filter=${LZString.compressToEncodedURIComponent(
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
              )}`}
              key={`${version}/${kind}`}
            >
              <TargetIcon version={version} kind={kind} />
              <span className="flex-grow">{kind}</span>
              <Badge
                variant="secondary"
                className="rounded-full bg-neutral-500/10 text-xs text-muted-foreground"
              >
                {count}
              </Badge>
            </SidebarLink>
          ))}
        </div>
      </div>
    </div>
  );
};
