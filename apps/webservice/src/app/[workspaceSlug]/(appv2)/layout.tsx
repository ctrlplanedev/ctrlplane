import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconCategory,
  IconChartBar,
  IconCube,
  IconPlug,
  IconRocket,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

export const metadata = {
  title: "Ctrlplane",
};

const SidebarIconLink: React.FC<{
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  href: string;
}> = ({ icon, label, href, active }) => {
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
              ? "bg-purple-500/10 text-purple-400"
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

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col">
      <nav className="flex h-14 w-full shrink-0 items-center bg-neutral-900/40 px-4">
        <Image
          src="/android-chrome-192x192.png"
          alt="Ctrlplane"
          width={24}
          height={24}
        />
      </nav>

      <div className="flex flex-1">
        <aside className="flex w-20 flex-col bg-neutral-900/40 pt-2">
          <SidebarIconLink
            active
            icon={<IconCube />}
            label="Resources"
            href="/"
          />
          <SidebarIconLink icon={<IconCategory />} label="Systems" href="/" />
          <SidebarIconLink icon={<IconRocket />} label="Deploys" href="/" />
          <SidebarIconLink icon={<IconChartBar />} label="Insights" href="/" />
          <div className="flex-grow" />
          <SidebarIconLink icon={<IconPlug />} label="Connect" href="/" />
        </aside>

        <div className="flex-1 rounded-tl-lg border-l border-t">{children}</div>
      </div>
    </div>
  );
}
