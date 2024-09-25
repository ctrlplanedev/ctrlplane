"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconBolt, IconCube, IconPlus, IconRocket } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

import { api } from "~/trpc/react";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(params.workspaceSlug);
  const workspaceId = workspace.data?.id ?? "";
  const agents = api.job.agent.byWorkspaceId.useQuery(workspaceId, {
    enabled: workspace.isSuccess,
  });
  return (
    <>
      <div className="flex items-center gap-2 border-b px-2">
        <div className="flex items-center gap-2 p-3">
          <IconRocket /> Jobs
        </div>
        <div className="flex-grow">
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/job-agents`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(
                      `/${params.workspaceSlug}/job-agents`,
                    )}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconCube /> Agents
                    <Badge
                      className="rounded-full border-neutral-900 text-inherit"
                      variant="outline"
                    >
                      {agents.data?.length ?? "-"}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link
                  href={`/${params.workspaceSlug}/jobs`}
                  legacyBehavior
                  passHref
                >
                  <NavigationMenuLink
                    active={pathname.includes(`/${params.workspaceSlug}/jobs`)}
                    className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                  >
                    <IconBolt /> Runs
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div>
          <Link href={`/${params.workspaceSlug}/job-agents/integrations`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <IconPlus /> Add Agent
            </Button>
          </Link>
        </div>
      </div>
      {children}
    </>
  );
}
