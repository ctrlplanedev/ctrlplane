"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconBolt } from "@tabler/icons-react";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

import { nFormatter } from "../../_components/nFormatter";

type RunbookNavBarProps = {
  totalJobs: number;
  runbook: NonNullable<RouterOutputs["runbook"]["byId"]>;
};

export const RunbookNavBar: React.FC<RunbookNavBarProps> = ({
  totalJobs,
  runbook,
}) => {
  const { workspaceSlug, systemSlug, runbookId } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    runbookId: string;
  }>();

  const pathname = usePathname();

  const baseUrl = `/${workspaceSlug}/systems/${systemSlug}/runbooks/${runbookId}`;
  const settingsUrl = `${baseUrl}/settings`;

  const isSettingsActive = pathname.endsWith("/settings");
  const isJobsActive = !isSettingsActive;

  return (
    <div className="flex items-center justify-between border-b p-2">
      <div>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href={baseUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isJobsActive}
                >
                  Jobs
                  <Badge
                    variant="outline"
                    className="ml-1.5 rounded-full text-muted-foreground"
                  >
                    {nFormatter(totalJobs, 1)}
                  </Badge>
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            {runbook.runhooks.length === 0 && (
              <NavigationMenuItem>
                <Link href={settingsUrl} legacyBehavior passHref>
                  <NavigationMenuLink
                    className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                    active={isSettingsActive}
                  >
                    Settings
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <Button variant="secondary" className="flex items-center gap-2">
        <IconBolt className="h-4 w-4" />
        Trigger runbook
      </Button>
    </div>
  );
};
