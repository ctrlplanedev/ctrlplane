"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@ctrlplane/ui/navigation-menu";

interface NavigationMenuTabProps {
  href: string;
  children?: React.ReactNode;
  exact?: boolean;
}

export const NavigationMenuTab: React.FC<NavigationMenuTabProps> = ({
  children,
  href,
  exact = false,
}) => {
  const pathname = usePathname();
  return (
    <Link href={href} legacyBehavior passHref>
      <NavigationMenuLink
        className={navigationMenuTriggerStyle()}
        active={exact ? pathname === href : pathname.includes(href)}
      >
        {children}
      </NavigationMenuLink>
    </Link>
  );
};
