"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { IconRocket } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";

import { urls } from "~/app/urls";

export const DeploymentsSidebarIcon: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspaceUrls = urls.workspace(workspaceSlug);
  const deploymentsUrl = workspaceUrls.deployments();
  const systemsUrl = workspaceUrls.systems();

  const pathname = usePathname();
  const active =
    pathname.startsWith(deploymentsUrl) || pathname.startsWith(systemsUrl);

  return (
    <div className="size-20 text-muted-foreground">
      <Link
        href={systemsUrl}
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
          <IconRocket />
        </span>
        <span className={cn("text-xs", active && "text-purple-400")}>
          Deploys
        </span>
      </Link>
    </div>
  );
};
