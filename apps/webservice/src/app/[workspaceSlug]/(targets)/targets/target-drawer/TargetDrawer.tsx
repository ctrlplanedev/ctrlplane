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
import { JobsContent } from "./JobsContent";
import { OverviewContent } from "./OverviewContent";
import { RelationshipsContent } from "./RelationshipContent";
import { VariableContent } from "./VariablesContent";

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <Button
    onClick={onClick}
    variant="ghost"
    className={cn(
      "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0 pr-3",
      active
        ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
        : "text-muted-foreground",
    )}
  >
    {icon}
    {label}
  </Button>
);

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
                <TabButton
                  active={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  icon={<TbInfoCircle className="h-4 w-4" />}
                  label="Overview"
                />
                <TabButton
                  active={activeTab === "deployments"}
                  onClick={() => setActiveTab("deployments")}
                  icon={<TbPackage className="h-4 w-4" />}
                  label="Deployments"
                />
                <TabButton
                  active={activeTab === "jobs"}
                  onClick={() => setActiveTab("jobs")}
                  icon={<TbHistory className="h-4 w-4" />}
                  label="Job History"
                />
                <TabButton
                  active={activeTab === "variables"}
                  onClick={() => setActiveTab("variables")}
                  icon={<TbVariable className="h-4 w-4" />}
                  label="Variables"
                />
                <TabButton
                  active={activeTab === "relationships"}
                  onClick={() => setActiveTab("relationships")}
                  icon={<TbTopologyStar3 className="h-4 w-4" />}
                  label="Relationships"
                />
              </div>
              <div className="w-full overflow-auto">
                {activeTab === "deployments" && (
                  <DeploymentsContent targetId={target.id} />
                )}
                {activeTab === "overview" && (
                  <OverviewContent target={target} />
                )}
                {activeTab === "relationships" && (
                  <RelationshipsContent target={target} />
                )}
                {activeTab === "jobs" && <JobsContent targetId={target.id} />}
                {activeTab === "variables" && (
                  <VariableContent targetId={target.id} />
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
