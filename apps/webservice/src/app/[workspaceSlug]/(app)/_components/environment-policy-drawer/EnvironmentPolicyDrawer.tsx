"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import {
  IconCalendar,
  IconCircuitDiode,
  IconDotsVertical,
  IconEye,
  IconFilter,
  IconInfoCircle,
  IconLoader2,
  IconRocket,
  IconTrash,
} from "@tabler/icons-react";
import _ from "lodash";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";

import { Button } from "@ctrlplane/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@ctrlplane/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Form, useForm } from "@ctrlplane/ui/form";

import type { PolicyFormSchema } from "./PolicyFormSchema";
import { api } from "~/trpc/react";
import { TabButton } from "../TabButton";
import { ApprovalAndGovernance } from "./ApprovalAndGovernance";
import { DeploymentControl } from "./DeploymentControl";
import { Overview } from "./Overview";
import { DeleteEnvironmentPolicyDialog } from "./PolicyDeleteDialog";
import { policyFormSchema } from "./PolicyFormSchema";
import { ReleaseChannels } from "./ReleaseChannels";
import { ReleaseManagement } from "./ReleaseManagement";
import { RolloutAndTiming } from "./RolloutAndTiming";
import { useEnvironmentPolicyDrawer } from "./useEnvironmentPolicyDrawer";

export enum EnvironmentPolicyDrawerTab {
  Overview = "overview",
  Approval = "approval",
  Concurrency = "concurrency",
  Management = "management",
  ReleaseChannels = "release-channels",
  Rollout = "rollout",
}

type PolicyConfigProps = {
  activeTab: EnvironmentPolicyDrawerTab;
  environmentPolicy: SCHEMA.EnvironmentPolicy & {
    releaseWindows: SCHEMA.EnvironmentPolicyReleaseWindow[];
    releaseChannels: SCHEMA.ReleaseChannel[];
  };
  deployments: Deployment[];
};

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

const View: React.FC<
  PolicyConfigProps & {
    form: PolicyFormSchema;
  }
> = (props) =>
  ({
    [EnvironmentPolicyDrawerTab.Overview]: <Overview {...props} />,
    [EnvironmentPolicyDrawerTab.Approval]: <ApprovalAndGovernance {...props} />,
    [EnvironmentPolicyDrawerTab.Concurrency]: <DeploymentControl {...props} />,
    [EnvironmentPolicyDrawerTab.Management]: <ReleaseManagement {...props} />,
    [EnvironmentPolicyDrawerTab.Rollout]: <RolloutAndTiming {...props} />,
    [EnvironmentPolicyDrawerTab.ReleaseChannels]: (
      <ReleaseChannels {...props} />
    ),
  })[props.activeTab];

const PolicyConfigForm: React.FC<PolicyConfigProps> = ({
  activeTab,
  environmentPolicy,
  deployments,
}) => {
  const updateEnvironmentPolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const form = useForm({
    schema: policyFormSchema,
    defaultValues: {
      ...environmentPolicy,
      description: environmentPolicy.description ?? "",
      rolloutDuration: prettyMilliseconds(environmentPolicy.rolloutDuration),
      releaseChannels: _.chain(deployments)
        .keyBy((d) => d.id)
        .mapValues(
          (d) =>
            environmentPolicy.releaseChannels.find(
              (rc) => rc.deploymentId === d.id,
            )?.id ?? null,
        )
        .value(),
    },
  });

  const { id, systemId } = environmentPolicy;
  const onSubmit = form.handleSubmit(async (policy) => {
    const data = { ...policy, rolloutDuration: ms(policy.rolloutDuration) };
    await updateEnvironmentPolicy
      .mutateAsync({ data, id })
      .then(() => form.reset(policy))
      .then(() => utils.environment.policy.byId.invalidate(id))
      .then(() => utils.environment.policy.bySystemId.invalidate(systemId));
  });

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col justify-between overflow-auto"
      >
        <View
          activeTab={activeTab}
          environmentPolicy={environmentPolicy}
          deployments={deployments}
          form={form}
        />

        <div className="flex justify-end pr-2">
          <Button
            onClick={onSubmit}
            disabled={
              updateEnvironmentPolicy.isPending || !form.formState.isDirty
            }
            className="w-fit"
          >
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
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
  const { environmentPolicyId, removeEnvironmentPolicyId, tab, setTab } =
    useEnvironmentPolicyDrawer();
  const isOpen = Boolean(environmentPolicyId);
  const setIsOpen = removeEnvironmentPolicyId;
  const environmentPolicyQ = api.environment.policy.byId.useQuery(
    environmentPolicyId ?? "",
    { enabled: isOpen },
  );
  const environmentPolicy = environmentPolicyQ.data;

  const deploymentsQ = api.deployment.bySystemId.useQuery(
    environmentPolicy?.systemId ?? "",
    { enabled: isOpen && environmentPolicy != null },
  );
  const deployments = deploymentsQ.data;

  const loading = environmentPolicyQ.isLoading || deploymentsQ.isLoading;

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerContent
        showBar={false}
        className="left-auto right-0 top-0 mt-0 h-screen w-[1100px] overflow-auto rounded-none focus-visible:outline-none"
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

        <div className="flex h-full w-full gap-6 p-6">
          <div className="space-y-1">
            <TabButton
              active={
                tab === EnvironmentPolicyDrawerTab.Overview || tab == null
              }
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Overview)}
              icon={<IconInfoCircle className="h-4 w-4" />}
              label="Overview"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Approval}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Approval)}
              icon={<IconEye className="h-4 w-4" />}
              label="Approval & Governance"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Concurrency}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Concurrency)}
              icon={<IconCircuitDiode className="h-4 w-4" />}
              label="Deployment Control"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Management}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Management)}
              icon={<IconRocket className="h-4 w-4" />}
              label="Release Management"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.ReleaseChannels}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.ReleaseChannels)}
              icon={<IconFilter className="h-4 w-4" />}
              label="Release Channels"
            />
            <TabButton
              active={tab === EnvironmentPolicyDrawerTab.Rollout}
              onClick={() => setTab(EnvironmentPolicyDrawerTab.Rollout)}
              icon={<IconCalendar className="h-4 w-4" />}
              label="Rollout and Timing"
            />
          </div>

          {loading && (
            <div className="flex h-full w-full items-center justify-center">
              <IconLoader2 className="animate-spin" />
            </div>
          )}
          {!loading && environmentPolicy != null && deployments != null && (
            <PolicyConfigForm
              activeTab={tab ?? EnvironmentPolicyDrawerTab.Overview}
              environmentPolicy={environmentPolicy}
              deployments={deployments}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
