"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

export default function TargetLayout({
  children,
  params,
}: {
  params: { workspaceSlug: string; targetId: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const baseUrl = `/${params.workspaceSlug}/targets/${params.targetId}`;
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
