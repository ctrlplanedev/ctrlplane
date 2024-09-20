"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TbCube, TbList, TbPlus, TbTarget } from "react-icons/tb";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

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
  const targets = api.target.byWorkspaceId.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );

  const metadataGroups = api.target.metadataGroup.groups.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );
  const targetProviders = api.target.provider.byWorkspaceId.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess && workspace.data?.id !== "" },
  );
  return (
    <>
      <div className="flex items-center gap-2 border-b px-2">
        <div className="flex items-center gap-2 p-3">
          <TbTarget /> Targets
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
                    <TbList /> List
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
                    <TbCube /> Providers
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
                    <TbList /> Groups
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {metadataGroups.data?.length ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div>
          <Link href={`/${workspaceSlug}/target-providers/integrations`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <TbPlus /> Add Provider
            </Button>
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
