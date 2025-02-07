"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@ctrlplane/ui";

export const TopSidebarIcon: React.FC<{
  icon: React.ReactNode;
  label: string;
  href: string;
}> = ({ icon, label, href }) => {
  const pathname = usePathname();
  const active = pathname.startsWith(href);

  return (
    <div className="size-20 text-muted-foreground">
      <Link
        href={href}
        className={cn(
          "border-r-1 group flex h-full flex-col items-center justify-center gap-1 p-2",
        )}
      >
        <span
          className={cn(
            "rounded-lg p-2",
            active
              ? "bg-purple-500/20 text-purple-400"
              : "transition-colors duration-200 group-hover:bg-neutral-400/10",
          )}
        >
          {icon}
        </span>
        <span className={cn("text-xs", active && "text-purple-400")}>
          {label}
        </span>
      </Link>
    </div>
  );
};
