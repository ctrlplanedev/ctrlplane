import React from "react";
import Link from "next/link";
import {
  IconBook,
  IconCategory,
  IconChartBar,
  IconCube,
  IconPlug,
  IconRocket,
  IconSettings,
} from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { TopNav } from "./TopNav";

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

export default async function Layout(props: {
  params: Promise<{ workspaceSlug: string }>;
  children: React.ReactNode;
}) {
  const params = await props.params;
  return (
    <div className="flex h-screen w-full flex-col">
      <TopNav workspaceSlug={params.workspaceSlug} />

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
          <SidebarIconLink icon={<IconBook />} label="Runbooks" href="/" />
          <SidebarIconLink icon={<IconChartBar />} label="Insights" href="/" />
          <div className="flex-grow" />
          <SidebarIconLink icon={<IconPlug />} label="Connect" href="/" />
          <SidebarIconLink icon={<IconSettings />} label="Settings" href="/" />
        </aside>

        <div className="flex-1 rounded-tl-lg border-l border-t">
          {props.children}
        </div>
      </div>
    </div>
  );
}
