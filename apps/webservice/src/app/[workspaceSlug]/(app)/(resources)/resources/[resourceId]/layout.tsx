"use client";;
import { use } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

export default function ResourceLayout(
  props: {
    params: Promise<{ workspaceSlug: string; resourceId: string }>;
    children: React.ReactNode;
  }
) {
  const params = use(props.params);

  const {
    children
  } = props;

  const pathname = usePathname();
  const baseUrl = `/${params.workspaceSlug}/resources/${params.resourceId}`;
  return (
    <>
      <div className="border-b p-2">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href={baseUrl} legacyBehavior passHref>
                <NavigationMenuLink
                  active={pathname === baseUrl}
                  className={navigationMenuTriggerStyle()}
                >
                  Overview
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
              <Link href={`${baseUrl}/deployments`} legacyBehavior passHref>
                <NavigationMenuLink
                  active={pathname.startsWith(`${baseUrl}/deployments`)}
                  className={navigationMenuTriggerStyle()}
                >
                  Deployments
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
      {children}
    </>
  );
}
