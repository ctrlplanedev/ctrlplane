"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { IconFilter, IconLoader2 } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@ctrlplane/ui/drawer";

import type { Policy } from "./types";
import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { DeployableVersionsTable } from "./DeployableVersionsTable";
import { PolicyVersionSelectorTable } from "./PolicyVersionSelectorTable";
import { useVersionSelectorDrawer } from "./useVersionSelectorDrawer";

const PolicyLink: React.FC<{ policy: Policy }> = ({ policy }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const policyUrl = urls
    .workspace(workspaceSlug)
    .policies()
    .edit(policy.id)
    .deploymentFlow();

  return (
    <Link
      href={policyUrl}
      key={policy.id}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "text-xs text-foreground",
      )}
    >
      {policy.name}
    </Link>
  );
};

const VersionSelectorDrawerHeader: React.FC<{ policies: Policy[] }> = ({
  policies,
}) => (
  <DrawerHeader className="space-y-2 border-b p-4">
    <DrawerTitle className="flex items-center gap-2 text-lg font-medium">
      <div className="flex items-center justify-center rounded-lg bg-blue-600/70 p-1">
        <IconFilter className="h-6 w-6 text-blue-400" />
      </div>
      Version selector
    </DrawerTitle>
    <DrawerDescription className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        {policies.map((p) => (
          <PolicyLink key={p.id} policy={p} />
        ))}
      </div>
    </DrawerDescription>
  </DrawerHeader>
);

export const VersionSelectorDrawer: React.FC = () => {
  const { releaseTargetId, removeReleaseTargetId } = useVersionSelectorDrawer();
  const isOpen = releaseTargetId != null;

  const { data, isLoading } =
    api.policy.versionSelector.byReleaseTargetId.useQuery(
      releaseTargetId ?? "",
      { enabled: isOpen },
    );

  return (
    <Drawer open={isOpen} onOpenChange={removeReleaseTargetId}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-1/2 overflow-auto rounded-none rounded-l-lg focus-visible:outline-none"
      >
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {data != null && (
          <div>
            <VersionSelectorDrawerHeader policies={data} />
            <div className="space-y-8 p-4">
              <PolicyVersionSelectorTable policies={data} />
              <DeployableVersionsTable
                releaseTargetId={releaseTargetId ?? ""}
              />
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
