"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@ctrlplane/ui";

export const SidebarLink: React.FC<{
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  hideActiveEffect?: boolean;
}> = ({ href, exact, children, hideActiveEffect }) => {
  const pathname = usePathname();
  const active = hideActiveEffect
    ? false
    : exact
      ? pathname === href
      : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        active ? "bg-neutral-800/70" : "hover:bg-neutral-800/50",
        "flex items-center gap-2 rounded-md px-2 py-1",
      )}
    >
      {children}
    </Link>
  );
};
