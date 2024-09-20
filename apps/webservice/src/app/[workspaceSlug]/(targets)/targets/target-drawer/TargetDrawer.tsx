"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TbExternalLink,
  TbHistory,
  TbInfoCircle,
  TbLock,
  TbLockOpen,
  TbPackage,
  TbTopologyStar3,
  TbVariable,
} from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { DeploymentsContent } from "./DeploymentContent";
import { OverviewContent } from "./OverviewContent";
import { RelationshipsContent } from "./RelationshipContent";

export const TargetDrawer: React.FC<{
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  targetId?: string;
}> = ({ isOpen, setIsOpen, targetId }) => {
  const targetQ = api.target.byId.useQuery(targetId ?? "", {
    enabled: targetId != null,
    refetchInterval: 10_000,
  });

  const target = targetQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const lockTarget = api.target.lock.useMutation();
  const unlockTarget = api.target.unlock.useMutation();
  const utils = api.useUtils();

  const links =
    target?.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(target.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none"
      >
        <div className="border-b p-6">
          <div className="flex items-center ">
            <DrawerTitle className="flex-grow">{target?.name}</DrawerTitle>
          </div>
          {target != null && (
            <div className="mt-3 flex flex-wrap gap-2">
              {links != null && (
                <>
                  {Object.entries(links).map(([label, url]) => (
                    <Link
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        className: "gap-1",
                      })}
                      // className="flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-sm text-muted-foreground hover:bg-neutral-700 hover:text-white"
                    >
                      <TbExternalLink />
                      {label}
                    </Link>
                  ))}
                </>
              )}

              <Button
                variant="outline"
                className="gap-1"
                size="sm"
                onClick={() =>
                  (target.lockedAt != null ? unlockTarget : lockTarget)
                    .mutateAsync(target.id)
                    .then(() => utils.target.byId.invalidate(targetId))
                }
              >
                {target.lockedAt != null ? (
                  <>
                    <TbLockOpen /> Unlocked
                  </>
                ) : (
                  <>
                    <TbLock /> Lock
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {target != null && (
          <>
            <div className="flex w-full gap-6 p-6">
              <div className="space-y-1">
                <Button
                  onClick={() => setActiveTab("overview")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
                    activeTab === "overview"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbInfoCircle className="h-4 w-4" />
                  Overview
                </Button>
                <Button
                  onClick={() => setActiveTab("deployments")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
                    activeTab === "deployments"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbPackage className="h-4 w-4" />
                  Deployments
                </Button>
                <Button
                  onClick={() => setActiveTab("jobs")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
                    activeTab === "jobs"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbHistory className="h-4 w-4" />
                  Job History
                </Button>
                <Button
                  onClick={() => setActiveTab("variables")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
                    activeTab === "variables"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbVariable className="h-4 w-4" />
                  Variables
                </Button>
                <Button
                  onClick={() => setActiveTab("relationships")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-4",
                    activeTab === "relationships"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbTopologyStar3 className="h-4 w-4" />
                  Relationships
                </Button>
              </div>
              <div className="w-full overflow-auto">
                {activeTab === "deployment" && (
                  <DeploymentsContent targetId={target.id} />
                )}
                {activeTab === "overview" && (
                  <OverviewContent target={target} />
                )}
                {activeTab === "relationships" && (
                  <RelationshipsContent target={target} />
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
