import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

import { api } from "~/trpc/server";
import { SystemBreadcrumbNavbar } from "../../../SystemsBreadcrumb";
import { TopNav } from "../../../TopNav";

function nFormatter(num: number, digits = 1) {
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
  const item = lookup.find((item) => num >= item.value);
  return item
    ? (num / item.value).toFixed(digits).replace(regexp, "").concat(item.symbol)
    : "0";
}

export default async function DeploymentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();
  const deployment = await api.deployment.bySlug(params);
  if (deployment == null) return notFound();

  const releases = await api.release.list({
    deploymentId: deployment.id,
    limit: 0,
  });

  const overviewUrl = `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}`;
  const releasesUrl = `${overviewUrl}/releases`;
  const variablesUrl = `${overviewUrl}/variables`;
  return (
    <>
      <TopNav>
        <SystemBreadcrumbNavbar params={params} />
      </TopNav>
      <CardHeader className="flex flex-col items-center space-y-0 border-b p-4 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 p-0">
          <CardTitle>{deployment.name}</CardTitle>
          <CardDescription>
            {deployment.description !== "" ? (
              deployment.description
            ) : (
              <span className="italic">Add description ...</span>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <div className="flex items-center justify-between border-b p-2">
        <div>
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Link href={releasesUrl} legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Releases
                    <Badge
                      variant="outline"
                      className="ml-1.5 rounded-full text-muted-foreground"
                    >
                      {nFormatter(releases.total)}
                    </Badge>
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href={variablesUrl} legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Variables
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href={variablesUrl} legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Jobs
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <Link href={overviewUrl} legacyBehavior passHref>
                  <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                    Settings
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div>
          <Button size="sm" variant="secondary">
            New Release
          </Button>
        </div>
      </div>

      <div className="h-[calc(100vh-53px-73px-49px)] overflow-auto pb-8">
        {children}
      </div>
    </>
  );
}
