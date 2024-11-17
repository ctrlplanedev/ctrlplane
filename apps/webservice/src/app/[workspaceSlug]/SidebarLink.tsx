"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@ctrlplane/ui";

import { useSidebar } from "./SidebarContext";

export const SidebarLink: React.FC<{
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
  hideActiveEffect?: boolean;
}> = ({ href, exact, children, className, hideActiveEffect }) => {
  const { setActiveSidebarItem } = useSidebar();
  const pathname = usePathname();
  const active = hideActiveEffect
    ? false
    : exact
      ? pathname === href
      : pathname.startsWith(href);
  return (
    <Link
      href={href}
      onClick={() => {
        console.log("setting null");
        setActiveSidebarItem(null);
      }}
      className={cn(
        className,
        active ? "bg-neutral-800/70" : "hover:bg-neutral-800/50",
        "flex items-center gap-2 rounded-md px-2 py-1",
      )}
    >
      {children}
    </Link>
  );
};
