"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/_components/DeploymentOptionsDropdown";
import { api } from "~/trpc/react";
import { CreateVaribaleDialog } from "./CreateVariableDialog";

export const DeploymentsNavBar: React.FC = () => {
  const pathname = usePathname();
  const params = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();
  const deployment = api.deployment.bySlug.useQuery(params);
  const baseUrl = `/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}`;
  return (
    <div className="flex w-full items-center gap-4 border-b p-2">
      <div className="flex-grow">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href={`${baseUrl}`} legacyBehavior passHref>
                <NavigationMenuLink
                  active={pathname === baseUrl}
                  className={navigationMenuTriggerStyle()}
                >
                  Releases
                </NavigationMenuLink>
              </Link>

              <Link href={`${baseUrl}/variables`} legacyBehavior passHref>
                <NavigationMenuLink
                  active={pathname.startsWith(`${baseUrl}/variables`)}
                  className={navigationMenuTriggerStyle()}
                >
                  Variables
                </NavigationMenuLink>
              </Link>

              {deployment.data && (
                <DeploymentOptionsDropdown {...deployment.data} />
              )}
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      {pathname.startsWith(`${baseUrl}/variables`) && (
        <CreateVaribaleDialog deploymentId={deployment.data?.id ?? ""}>
          <Button
            variant="secondary"
            className="flex shrink-0 items-center gap-2"
          >
            <IconPlus className="h-4 w-4" />
            Add Varibale
          </Button>
        </CreateVaribaleDialog>
      )}
    </div>
  );
};
