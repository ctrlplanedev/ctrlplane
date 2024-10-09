"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconCircuitDiode,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconInfoCircle,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { ApprovalAndGovernance } from "./ApprovalAndGovernance";
import { DeploymentControl } from "./DeploymentControl";
import { Overview } from "./Overview";
import { DeleteEnvironmentPolicyDialog } from "./PolicyDeleteDialog";
import { ReleaseManagement } from "./ReleaseManagement";
import { RolloutAndTiming } from "./RolloutAndTiming";

const param = "environment_policy_id";
export const useEnvironmentPolicyDrawer = () => {
  const router = useRouter();
  const params = useSearchParams();
  const environmentPolicyId = params.get(param);

  const setEnvironmentPolicyId = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id === null) {
      url.searchParams.delete(param);
    } else {
      url.searchParams.set(param, id);
    }
    router.replace(url.toString());
  };

  const removeEnvironmentPolicyId = () => setEnvironmentPolicyId(null);

  return {
    environmentPolicyId,
    setEnvironmentPolicyId,
    removeEnvironmentPolicyId,
  };
};

const View: React.FC<{
  activeTab: string;
  environmentPolicy: SCHEMA.EnvironmentPolicy & {
    releaseWindows: SCHEMA.EnvironmentPolicyReleaseWindow[];
  };
}> = ({ activeTab, environmentPolicy }) => {
  return {
    overview: <Overview environmentPolicy={environmentPolicy} />,
    approval: <ApprovalAndGovernance environmentPolicy={environmentPolicy} />,
    concurrency: <DeploymentControl environmentPolicy={environmentPolicy} />,
    management: <ReleaseManagement environmentPolicy={environmentPolicy} />,
    rollout: <RolloutAndTiming environmentPolicy={environmentPolicy} />,
  }[activeTab];
};

const PolicyDropdownMenu: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
  children: React.ReactNode;
}> = ({ environmentPolicy, children }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DeleteEnvironmentPolicyDialog environmentPolicy={environmentPolicy}>
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(e) => e.preventDefault()}
        >
          <IconTrash className="h-4 w-4 text-red-500" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DeleteEnvironmentPolicyDialog>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const EnvironmentPolicyDrawer: React.FC = () => {
  const { environmentPolicyId, removeEnvironmentPolicyId } =
    useEnvironmentPolicyDrawer();
  const isOpen = environmentPolicyId != null && environmentPolicyId != "";
  const setIsOpen = removeEnvironmentPolicyId;
  const environmentPolicyQ = api.environment.policy.byId.useQuery(
    environmentPolicyId ?? "",
    { enabled: isOpen },
  );
  const environmentPolicy = environmentPolicyQ.data;

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-[1200px] overflow-auto rounded-none focus-visible:outline-none"
      >
        <DrawerTitle className="flex items-center gap-2 border-b p-6">
          <div className="flex-shrink-0 rounded bg-purple-500/20 p-1 text-purple-400">
            <IconFilter className="h-4 w-4" />
          </div>
          {(environmentPolicy == null || environmentPolicy.name === "") &&
            "Policy"}
          {environmentPolicy != null && environmentPolicy.name !== "" && (
            <span>{environmentPolicy.name}</span>
          )}
          {environmentPolicy != null && (
            <PolicyDropdownMenu environmentPolicy={environmentPolicy}>
              <Button variant="ghost" size="icon">
                <IconDotsVertical className="h-4 w-4" />
              </Button>
            </PolicyDropdownMenu>
          )}
        </DrawerTitle>

        <div className="flex w-full gap-6 p-6">
          <div className="space-y-1">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              icon={<IconInfoCircle className="h-4 w-4" />}
              label="Overview"
            />
            <TabButton
              active={activeTab === "approval"}
              onClick={() => setActiveTab("approval")}
              icon={<IconEye className="h-4 w-4" />}
              label="Approval & Governance"
            />
            <TabButton
              active={activeTab === "concurrency"}
              onClick={() => setActiveTab("concurrency")}
              icon={<IconCircuitDiode className="h-4 w-4" />}
              label="Deployment Control"
            />
            <TabButton
              active={activeTab === "management"}
              onClick={() => setActiveTab("management")}
              icon={<IconRocket className="h-4 w-4" />}
              label="Release Management"
            />
            <TabButton
              active={activeTab === "rollout"}
              onClick={() => setActiveTab("rollout")}
              icon={<IconCalendar className="h-4 w-4" />}
              label="Rollout and Timing"
            />
          </div>

          {environmentPolicy != null && (
            <div className="w-full overflow-auto">
              <View
                activeTab={activeTab}
                environmentPolicy={environmentPolicy}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
