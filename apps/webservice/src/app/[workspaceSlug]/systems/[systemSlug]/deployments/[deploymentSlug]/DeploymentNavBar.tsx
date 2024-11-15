"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { Badge } from "@ctrlplane/ui/badge";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@ctrlplane/ui/navigation-menu";

import { NavigationMenuAction } from "./NavigationMenuAction";

type DeploymentNavBarProps = {
  deployment: {
    id: string;
    systemId: string;
  };
  totalReleases: number;
};

const nFormatter = (num: number, digits: number) => {
  const lookup = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ];
  const regexp = /\.0+$|(?<=\.[0-9]*[1-9])0+$/;
  const item = lookup.reverse().find((item) => num >= item.value);
  return item
    ? (num / item.value).toFixed(digits).replace(regexp, "").concat(item.symbol)
    : "0";
};

export const DeploymentNavBar: React.FC<DeploymentNavBarProps> = ({
  deployment,
  totalReleases,
}) => {
  const { workspaceSlug, systemSlug, deploymentSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  const pathname = usePathname();

  const releasesUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/releases`;
  const variablesUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/variables`;
  const releaseChannelsUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/release-channels`;
  const overviewUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}`;
  const hooksUrl = `/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/hooks`;

  const isReleasesActive = pathname.includes("/releases");
  const isVariablesActive = pathname.includes("/variables");
  const isJobsActive = pathname.includes("/jobs");
  const isReleaseChannelsActive = pathname.includes("/release-channels");
  const isHooksActive = pathname.includes("/hooks");
  const isSettingsActive =
    !isReleasesActive &&
    !isVariablesActive &&
    !isJobsActive &&
    !isReleaseChannelsActive &&
    !isHooksActive;

  return (
    <div className="flex items-center justify-between border-b p-2">
      <div>
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href={releasesUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isReleasesActive}
                >
                  Releases
                  <Badge
                    variant="outline"
                    className="ml-1.5 rounded-full text-muted-foreground"
                  >
                    {nFormatter(totalReleases, 1)}
                  </Badge>
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={releaseChannelsUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isReleaseChannelsActive}
                >
                  Channels
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={variablesUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isVariablesActive}
                >
                  Variables
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={variablesUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isJobsActive}
                >
                  Jobs
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={hooksUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isHooksActive}
                >
                  Hooks
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={overviewUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/50 hover:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                  active={isSettingsActive}
                >
                  Settings
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      <NavigationMenuAction
        deploymentId={deployment.id}
        systemId={deployment.systemId}
      />
    </div>
  );
};
