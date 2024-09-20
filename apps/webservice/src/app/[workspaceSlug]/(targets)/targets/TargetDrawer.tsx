"use client";

import type { Target, TargetProvider } from "@ctrlplane/db/schema";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  TbExternalLink,
  TbHistory,
  TbInfoCircle,
  TbLock,
  TbLockOpen,
  TbPackage,
  TbSparkles,
  TbTag,
  TbVariable,
} from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { Input } from "@ctrlplane/ui/input";
import { TableCell, TableHead } from "@ctrlplane/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { useMatchSorterWithSearch } from "~/utils/useMatchSorter";

const TargetMetadataInfo: React.FC<{ metadata: Record<string, string> }> = (
  props,
) => {
  const metadata = Object.entries(props.metadata).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );
  const { search, setSearch, result } = useMatchSorterWithSearch(metadata, {
    keys: ["0", "1"],
  });
  return (
    <div>
      <div className="text-xs">
        <div>
          <Input
            className="w-full rounded-b-none text-xs"
            placeholder="Search ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 overflow-auto rounded-b-lg border-x border-b p-1.5">
          {result.map(([key, value]) => (
            <div className="text-nowrap font-mono" key={key}>
              <span>
                {Object.values(ReservedMetadataKey).includes(
                  key as ReservedMetadataKey,
                ) && (
                  <TbSparkles className="inline-block text-yellow-300" />
                )}{" "}
              </span>
              <span className="text-red-400">{key}:</span>
              <span className="text-green-300"> {value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DeploymentsContent: React.FC<{ targetId: string }> = ({ targetId }) => {
  const deployments = api.deployment.byTargetId.useQuery(targetId);
  const targetValues = api.deployment.variable.byTargetId.useQuery(targetId);

  if (!deployments.data || deployments.data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        This target is not part of any deployments.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deployments.data.map((deployment) => {
        const deploymentVariables = targetValues.data?.filter(
          (v) => v.deploymentId === deployment.id,
        );
        return (
          <div key={deployment.id} className="space-y-2 text-base">
            <div className="flex items-center">
              <div className="flex-grow">
                {deployment.name}{" "}
                <span className="text-xs text-muted-foreground">
                  / {deployment.environment.name}
                </span>
              </div>
              <div
                className={cn(
                  "shrink-0 rounded-full px-2 text-xs",
                  deployment.releaseJobTrigger.job == null &&
                    "bg-neutral-800 text-muted-foreground",
                  deployment.releaseJobTrigger.job?.status === "completed" &&
                    "bg-green-500/30 text-green-400 text-muted-foreground",
                )}
              >
                {deployment.releaseJobTrigger.release?.version ??
                  "No deployments"}
              </div>
            </div>

            <Card>
              {deploymentVariables != null &&
                deploymentVariables.length === 0 && (
                  <div className="p-2 text-sm text-neutral-600">
                    No variables found
                  </div>
                )}
              {deploymentVariables && (
                <table className="w-full">
                  <tbody className="text-left">
                    {deploymentVariables.map(({ key, value }) => (
                      <tr className="text-sm" key={key}>
                        <TableCell className="p-3">{key}</TableCell>
                        <TableCell className="p-3">{value.value}</TableCell>
                        <TableHead />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
};

const OverviewContent: React.FC<{
  target: Target & {
    metadata: Record<string, string>;
    provider: TargetProvider | null;
  };
}> = ({ target }) => {
  const links =
    target.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(target.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm">Properties</div>
        <table
          width="100%"
          className="text-xs"
          style={{ tableLayout: "fixed" }}
        >
          <tbody>
            <tr>
              <td className="w-[130px] p-1 pr-2 text-muted-foreground">
                Identifier
              </td>
              <td>{target.identifier}</td>
            </tr>
            <tr>
              <td className="w-[130px] p-1 pr-2 text-muted-foreground">Name</td>
              <td>{target.name}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Version</td>
              <td>{target.version}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Kind</td>
              <td>{target.kind}</td>
            </tr>
            <tr>
              <td className="p-1 pr-2 text-muted-foreground">
                Target Provider
              </td>
              <td>
                {target.provider != null ? (
                  target.provider.name
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="cursor-help italic text-gray-500">
                          Not set
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[250px]">
                          The next target provider to insert a target with the
                          same identifier will become the owner of this target.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </td>
            </tr>

            <tr>
              <td className="p-1 pr-2 text-muted-foreground">Last Sync</td>
              <td>
                {target.updatedAt &&
                  format(target.updatedAt, "MM/dd/yyyy mm:hh:ss")}
              </td>
            </tr>
            <tr>
              <td className="p-1 pr-2 align-top text-muted-foreground">
                Links
              </td>
              <td>
                {links == null ? (
                  <span className="cursor-help italic text-gray-500">
                    Not set
                  </span>
                ) : (
                  <>
                    {Object.entries(links).map(([name, url]) => (
                      <a
                        key={name}
                        referrerPolicy="no-referrer"
                        href={url}
                        className="inline-block w-full overflow-hidden text-ellipsis text-nowrap text-blue-300 hover:text-blue-400"
                      >
                        {name}
                      </a>
                    ))}
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div className="mb-2 text-sm">Metadata</div>
        <div className="text-xs">
          <TargetMetadataInfo metadata={target.metadata} />
        </div>
      </div>
    </div>
  );
};

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) ref.current?.blur();
  }, [isOpen]);

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
        ref={ref}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none"
      >
        {target != null && (
          <>
            <div className="border-b p-6">
              <div className="flex items-center">
                <DrawerTitle className="flex-grow">{target.name}</DrawerTitle>
                <Button
                  variant="outline"
                  className="gap-1"
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
              {links != null && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(links).map(([label, url]) => (
                    <Link
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-sm text-muted-foreground hover:bg-neutral-700 hover:text-white"
                    >
                      <TbExternalLink className="h-4 w-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex w-full gap-6 p-6">
              <div className="space-y-1">
                <Button
                  onClick={() => setActiveTab("overview")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0",
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
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0",
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
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0",
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
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0",
                    activeTab === "variables"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbVariable className="h-4 w-4" />
                  Variables
                </Button>
                <Button
                  onClick={() => setActiveTab("metadata")}
                  variant="ghost"
                  className={cn(
                    "flex h-7 w-full items-center justify-normal gap-2 p-2 py-0",
                    activeTab === "metadata"
                      ? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/10 hover:text-blue-300"
                      : "text-muted-foreground",
                  )}
                >
                  <TbTag className="h-4 w-4" />
                  Metadata
                </Button>
              </div>
              <div className="w-full overflow-auto">
                {activeTab === "deployment" && (
                  <DeploymentsContent targetId={target.id} />
                )}
                {activeTab === "overview" && (
                  <OverviewContent target={target} />
                )}
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};
