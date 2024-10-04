"use client";

import type React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  IconList,
  IconPlus,
  IconServer,
  IconVariable,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

import { api } from "~/trpc/react";
import { CreateReleaseDialog } from "../_components/CreateRelease";
import { CreateVariableDialog } from "./[systemSlug]/deployments/[deploymentSlug]/CreateVariableDialog";

export const DeploymentNavigationMenu: React.FC = () => {
  const pathname = usePathname();
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const deployment = api.deployment.bySlug.useQuery({
    workspaceSlug,
    systemSlug,
    deploymentSlug,
  });

  const isAgentActive = pathname.includes(
    `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/configure/job-agent`,
  );

  const isVariablesActive = pathname.includes(
    `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/variables`,
  );

  const isReleasesActive = !isAgentActive && !isVariablesActive;

  return (
    <>
      <div className="flex-grow">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link
                href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`}
                legacyBehavior
                passHref
              >
                <NavigationMenuLink
                  active={isReleasesActive}
                  className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                >
                  <IconList className="h-4 w-4" /> Releases
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/configure/job-agent`}
                legacyBehavior
                passHref
              >
                <NavigationMenuLink
                  active={isAgentActive}
                  className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                >
                  <IconServer className="h-4 w-4" /> Agent
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link
                href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/variables`}
                legacyBehavior
                passHref
              >
                <NavigationMenuLink
                  active={isVariablesActive}
                  className="flex items-center gap-2 rounded-lg border border-neutral-900 px-2 py-1 text-sm text-muted-foreground data-[active]:border-neutral-800 data-[active]:bg-neutral-800/50 data-[active]:text-white"
                >
                  <IconVariable className="h-4 w-4" /> Variables
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      {isVariablesActive && deployment.data != null && (
        <CreateVariableDialog deploymentId={deployment.data.id}>
          <Button className="flex h-7 items-center gap-1 py-0">
            <IconPlus className="h-4 w-4" />
            Add Variable
          </Button>
        </CreateVariableDialog>
      )}
      {isReleasesActive && deployment.data != null && (
        <CreateReleaseDialog
          systemId={deployment.data.systemId}
          deploymentId={deployment.data.id}
        >
          <Button className="flex h-7 items-center py-0">New Release</Button>
        </CreateReleaseDialog>
      )}
    </>
  );
};
