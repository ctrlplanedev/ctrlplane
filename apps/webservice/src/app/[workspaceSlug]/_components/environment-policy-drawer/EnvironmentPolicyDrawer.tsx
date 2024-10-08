"use client";

import type React from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconCalendar,
  IconCheck,
  IconChecklist,
  IconCircuitDiode,
  IconClock,
  IconFilter,
  IconInfoCircle,
  IconPlayerPause,
} from "@tabler/icons-react";

import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";

import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { Approval } from "./Approval";
import { Concurrency } from "./Concurrency";
import { GradualRollouts } from "./GradualRollouts";
import { Overview } from "./Overview";
import { ReleaseFilter } from "./ReleaseFilter";
import { ReleaseSequencing } from "./ReleaseSequencing";
import { ReleaseWindows } from "./ReleaseWindows";
import { SuccessCriteria } from "./SuccessCriteria";

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
          {environmentPolicy?.name ?? "Policy"}
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
              icon={<IconCheck className="h-4 w-4" />}
              label="Approval"
            />
            <TabButton
              active={activeTab === "concurrency"}
              onClick={() => setActiveTab("concurrency")}
              icon={<IconCircuitDiode className="h-4 w-4" />}
              label="Concurrency"
            />
            <TabButton
              active={activeTab === "gradual-rollout"}
              onClick={() => setActiveTab("gradual-rollout")}
              icon={<IconClock className="h-4 w-4" />}
              label="Gradual Rollout"
            />
            <TabButton
              active={activeTab === "success-criteria"}
              onClick={() => setActiveTab("success-criteria")}
              icon={<IconChecklist className="h-4 w-4" />}
              label="Success Criteria"
            />
            <TabButton
              active={activeTab === "release-sequencing"}
              onClick={() => setActiveTab("release-sequencing")}
              icon={<IconPlayerPause className="h-4 w-4" />}
              label="Release Sequencing"
            />
            <TabButton
              active={activeTab === "release-windows"}
              onClick={() => setActiveTab("release-windows")}
              icon={<IconCalendar className="h-4 w-4" />}
              label="Release Windows"
            />
            <TabButton
              active={activeTab === "release-filter"}
              onClick={() => setActiveTab("release-filter")}
              icon={<IconFilter className="h-4 w-4" />}
              label="Release Filter"
            />
          </div>

          {environmentPolicy != null && (
            <div className="w-full overflow-auto">
              {activeTab === "overview" && (
                <Overview environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "approval" && (
                <Approval environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "concurrency" && (
                <Concurrency environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "gradual-rollout" && (
                <GradualRollouts environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "success-criteria" && (
                <SuccessCriteria environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "release-sequencing" && (
                <ReleaseSequencing environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "release-windows" && (
                <ReleaseWindows environmentPolicy={environmentPolicy} />
              )}
              {activeTab === "release-filter" && (
                <ReleaseFilter environmentPolicy={environmentPolicy} />
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
