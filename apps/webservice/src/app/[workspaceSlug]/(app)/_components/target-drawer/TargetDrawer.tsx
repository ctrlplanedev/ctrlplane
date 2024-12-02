"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IconDotsVertical,
  IconExternalLink,
  IconHistory,
  IconInfoCircle,
  IconLock,
  IconLockOpen,
  IconPackage,
  IconTerminal,
  IconTopologyStar3,
  IconVariable,
} from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

// import { useTerminalSessions } from "~/app/terminal/TerminalSessionsProvider";
import { api } from "~/trpc/react";
import { EditTargetDialog } from "../EditTarget";
import { TabButton } from "../TabButton";
import { DeploymentsContent } from "./DeploymentContent";
import { JobsContent } from "./JobsContent";
import { OverviewContent } from "./OverviewContent";
import { TargetActionsDropdown } from "./TargetActionsDropdown";
import { useTargetDrawer } from "./useTargetDrawer";
import { VariableContent } from "./VariablesContent";

export const TargetDrawer: React.FC = () => {
  const { targetId, removeTargetId } = useTargetDrawer();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const isOpen = targetId != null && targetId != "";
  const setIsOpen = removeTargetId;

  const targetQ = api.resource.byId.useQuery(targetId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });

  const resource = targetQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const lockTarget = api.resource.lock.useMutation();
  const unlockTarget = api.resource.unlock.useMutation();
  const router = useRouter();
  const utils = api.useUtils();

  const links =
    resource?.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
          string,
          string
        >)
      : null;

  // const { createSession, setIsDrawerOpen } = useTerminalSessions();

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-2/3 overflow-auto rounded-none"
      >
        <div className="border-b p-6">
          <div className="flex items-center">
            <DrawerTitle className="flex items-center gap-2">
              {resource?.name}
              {resource != null && (
                <TargetActionsDropdown target={resource}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <IconDotsVertical className="h-4 w-4" />
                  </Button>
                </TargetActionsDropdown>
              )}
            </DrawerTitle>
          </div>
          {resource != null && (
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
                      <IconExternalLink className="h-3 w-3" />
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
                  (resource.lockedAt != null ? unlockTarget : lockTarget)
                    .mutateAsync(resource.id)
                    .then(() => router.refresh())
                }
              >
                {resource.lockedAt != null ? (
                  <>
                    <IconLockOpen className="h-3 w-3" /> Unlock
                  </>
                ) : (
                  <>
                    <IconLock className="h-3 w-3" /> Lock
                  </>
                )}
              </Button>

              <Link
                href={`/${workspaceSlug}/targets/${resource.id}/visualize`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "gap-1",
                })}
              >
                <IconTopologyStar3 className="h-3 w-3" /> Visualize
              </Link>

              {resource.kind === "AccessNode" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    window.open(
                      `/terminal?resource=${resource.id}`,
                      "_blank",
                      "menubar=no,toolbar=no,location=no,status=no",
                    );
                  }}
                >
                  <IconTerminal className="h-3 w-3" /> Connect
                </Button>
              )}

              {resource.provider == null && (
                <EditTargetDialog
                  target={resource}
                  onSuccess={() => utils.resource.byId.invalidate(resource.id)}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resource.lockedAt != null}
                  >
                    Edit Target
                  </Button>
                </EditTargetDialog>
              )}
            </div>
          )}
        </div>

        {resource != null && (
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
            </div>
            <div className="h-full w-full overflow-auto">
              {activeTab === "deployments" && (
                <DeploymentsContent targetId={resource.id} />
              )}
              {activeTab === "overview" && (
                <OverviewContent target={resource} />
              )}
              {activeTab === "jobs" && <JobsContent targetId={resource.id} />}
              {activeTab === "variables" && (
                <VariableContent
                  targetId={resource.id}
                  targetVariables={resource.variables}
                />
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
