"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCube,
  IconFilter,
  IconList,
  IconPlus,
  IconTarget,
} from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

import { CreateTargetViewDialog } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionDialog";
import { api } from "~/trpc/react";

export default function TargetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const pathname = usePathname();
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const targets = api.resource.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.data?.id ?? "", limit: 0 },
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );
  const metadataGroups = api.resource.metadataGroup.groups.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );
  const targetProviders = api.resource.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );

  /**
   * Views is a 2016 album by Drake that showcases his blend of rap and R&B
   * with influences from his hometown, Toronto. It features hit singles like
   * "Hotline Bling" and "One Dance," reflecting Drake's introspective lyrics
   * on fame, relationships, and his rise to the top. The album explores
   * themes of loyalty and love, all while solidifying his position as one of
   * the most influential artists in contemporary hip-hop.
   *
   * This is NOT a reference to that album.
   */
  const views = api.resource.view.list.useQuery(workspace.data?.id ?? "", {
    enabled: workspace.isSuccess && workspace.data?.id !== "",
  });
  return (
    <>
      <div className="flex items-center gap-2 border-b px-2">
        <div className="flex items-center gap-2 p-3">
          <IconTarget className="h-4 w-4" /> Targets
        </div>
        <div className="flex-grow">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/targets`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(
                      `/${params.workspaceSlug}/targets`,
                    )}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconList className="h-4 w-4" /> List
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {targets.data?.total ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/target-providers`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(
                      `/${params.workspaceSlug}/target-providers`,
                    )}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconCube className="h-4 w-4" /> Providers
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {targetProviders.data?.length ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/target-metadata-groups`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(
                      `/${params.workspaceSlug}/target-metadata-groups`,
                    )}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconList className="h-4 w-4" /> Groups
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {metadataGroups.data?.length ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/target-views`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(
                      `/${params.workspaceSlug}/target-views`,
                    )}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconFilter className="h-4 w-4" /> Views
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {views.data?.length ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div>
          {!pathname.includes(`/${params.workspaceSlug}/target-views`) && (
            <Link href={`/${workspaceSlug}/target-providers/integrations`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <IconPlus className="h-4 w-4" /> Add Provider
              </Button>
            </Link>
          )}

          {pathname.includes(`/${params.workspaceSlug}/target-views`) && (
            <CreateTargetViewDialog workspaceId={workspace.data?.id ?? ""}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <IconPlus className="h-4 w-4" /> Add View
              </Button>
            </CreateTargetViewDialog>
          )}
        </div>
      </div>
      {children}
    </>
  );
}
