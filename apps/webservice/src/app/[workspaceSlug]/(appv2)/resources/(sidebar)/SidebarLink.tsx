"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@ctrlplane/ui";
import { SidebarMenuButton } from "@ctrlplane/ui/sidebar";

export const SidebarLink: React.FC<{
  icon?: React.ReactNode;
  href: string;
  children: React.ReactNode;
  exact?: boolean;
}> = ({ icon, href, children, exact = false }) => {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <SidebarMenuButton asChild>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 text-muted-foreground",
          active &&
            "bg-purple-500/10 text-purple-300 hover:!bg-purple-500/10 hover:!text-purple-300",
        )}
      >
        {icon}
        {children}
      </Link>
    </SidebarMenuButton>
  );
};
