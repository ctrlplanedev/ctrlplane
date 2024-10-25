"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconExternalLink,
  IconHistory,
  IconInfoCircle,
  IconLock,
  IconLockOpen,
  IconPackage,
  IconTopologyStar3,
  IconVariable,
} from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { EditTargetDialog } from "../EditTarget";
import { TabButton } from "../TabButton";
import { DeploymentsContent } from "./DeploymentContent";
import { JobsContent } from "./JobsContent";
import { OverviewContent } from "./OverviewContent";
import { RelationshipsContent } from "./relationships/RelationshipContent";
import { VariableContent } from "./VariablesContent";

const param = "target_id";
export const useTargetDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const targetId = params.get(param);

  const setTargetId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeTargetId = () => setTargetId(null);

  return { targetId, setTargetId, removeTargetId };
};

export const TargetDrawer: React.FC = () => {
  const { targetId, removeTargetId } = useTargetDrawer();
  const isOpen = targetId != null && targetId != "";
  const setIsOpen = removeTargetId;

  const targetQ = api.target.byId.useQuery(targetId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });

  const target = targetQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const lockTarget = api.target.lock.useMutation();
  const unlockTarget = api.target.unlock.useMutation();
  const router = useRouter();
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
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none focus-visible:outline-none"
      >
        <div className="border-b p-6">
          <div className="flex items-center">
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
                      <IconExternalLink className="h-4 w-4" />
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
                    .then(() => router.refresh())
                }
              >
                {target.lockedAt != null ? (
                  <>
                    <IconLockOpen className="h-4 w-4" /> Unlock
                  </>
                ) : (
                  <>
                    <IconLock className="h-4 w-4" /> Lock
                  </>
                )}
              </Button>

              {target.provider == null && (
                <EditTargetDialog
                  target={target}
                  onSuccess={() => utils.target.byId.invalidate(target.id)}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={target.lockedAt != null}
                  >
                    Edit Target
                  </Button>
                </EditTargetDialog>
              )}
            </div>
          )}
        </div>

        {target != null && (
          <div className="flex h-full w-full gap-6 p-6">
            <div className="space-y-1">
              <TabButton
                active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
                icon={<IconInfoCircle className="h-4 w-4" />}
                label="Overview"
              />
              <TabButton
                active={activeTab === "deployments"}
                onClick={() => setActiveTab("deployments")}
                icon={<IconPackage className="h-4 w-4" />}
                label="Deployments"
              />
              <TabButton
                active={activeTab === "jobs"}
                onClick={() => setActiveTab("jobs")}
                icon={<IconHistory className="h-4 w-4" />}
                label="Job History"
              />
              <TabButton
                active={activeTab === "variables"}
                onClick={() => setActiveTab("variables")}
                icon={<IconVariable className="h-4 w-4" />}
                label="Variables"
              />
              <TabButton
                active={activeTab === "relationships"}
                onClick={() => setActiveTab("relationships")}
                icon={<IconTopologyStar3 className="h-4 w-4" />}
                label="Relationships"
              />
            </div>
            <div className="h-full w-full overflow-auto">
              {activeTab === "deployments" && (
                <DeploymentsContent targetId={target.id} />
              )}
              {activeTab === "overview" && <OverviewContent target={target} />}
              {activeTab === "relationships" && (
                <RelationshipsContent target={target} />
              )}
              {activeTab === "jobs" && <JobsContent targetId={target.id} />}
              {activeTab === "variables" && (
                <VariableContent
                  targetId={target.id}
                  targetVariables={target.variables}
                />
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
