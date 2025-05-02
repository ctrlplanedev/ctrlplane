"use client";

import type { DirectResourceVariable } from "@ctrlplane/db/schema";
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

import { TabButton } from "~/app/[workspaceSlug]/(app)/_components/drawer/TabButton";
import { EditResourceDialog } from "~/app/[workspaceSlug]/(app)/_components/resources/EditResource";
import { urls } from "~/app/urls";
// import { useTerminalSessions } from "~/app/terminal/TerminalSessionsProvider";
import { api } from "~/trpc/react";
import { DeploymentsContent } from "./DeploymentContent";
import { JobsContent } from "./JobsContent";
import { OverviewContent } from "./OverviewContent";
import { ResourceActionsDropdown } from "./ResourceActionsDropdown";
import { useResourceDrawer } from "./useResourceDrawer";
import { VariableContent } from "./VariablesContent";

const getDirectVariables = (vars: any[]): DirectResourceVariable[] =>
  vars
    .filter((v) => v.valueType === "direct" && v.value !== null)
    .map((v) => ({
      id: v.id,
      resourceId: v.resourceId,
      key: v.key,
      valueType: "direct" as const,
      value: typeof v.value === "object" ? JSON.stringify(v.value) : v.value,
      sensitive: Boolean(v.sensitive),
    }));

export const ResourceDrawer: React.FC = () => {
  const { resourceId, removeResourceId } = useResourceDrawer();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const isOpen = resourceId != null && resourceId != "";
  const setIsOpen = removeResourceId;

  const resourceQ = api.resource.byId.useQuery(resourceId ?? "", {
    enabled: isOpen,
    refetchInterval: 10_000,
  });

  const resource = resourceQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  const lockResource = api.resource.lock.useMutation();
  const unlockResource = api.resource.unlock.useMutation();
  const router = useRouter();
  const utils = api.useUtils();

  const resourceVisualizeUrl = urls
    .workspace(workspaceSlug)
    .resource(resourceId ?? "")
    .visualize();

  const links =
    resource?.metadata[ReservedMetadataKey.Links] != null
      ? (JSON.parse(resource.metadata[ReservedMetadataKey.Links]) as Record<
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
          <div className="flex items-center">
            <DrawerTitle className="flex items-center gap-2">
              {resource?.name}
              {resource != null && (
                <ResourceActionsDropdown resource={resource}>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <IconDotsVertical className="h-4 w-4" />
                  </Button>
                </ResourceActionsDropdown>
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
                  (resource.lockedAt != null ? unlockResource : lockResource)
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
                href={resourceVisualizeUrl}
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
                <EditResourceDialog
                  resource={resource}
                  onSuccess={() => utils.resource.byId.invalidate(resource.id)}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resource.lockedAt != null}
                  >
                    Edit Resource
                  </Button>
                </EditResourceDialog>
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
                <DeploymentsContent resourceId={resource.id} />
              )}
              {activeTab === "overview" && (
                <OverviewContent resource={resource} />
              )}
              {activeTab === "jobs" && <JobsContent resourceId={resource.id} />}
              {activeTab === "variables" && (
                <VariableContent
                  resourceId={resource.id}
                  resourceVariables={getDirectVariables(resource.variables)}
                />
              )}
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};
