import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";

import { ApprovalAndGovernance } from "../../policy-form-components/ApprovalAndGovernance";
import { DeploymentControl } from "../../policy-form-components/DeploymentControl";
import { ReleaseChannels } from "../../policy-form-components/ReleaseChannels";
import { ReleaseManagement } from "../../policy-form-components/ReleaseManagement";
import { RolloutAndTiming } from "../../policy-form-components/RolloutAndTiming";
import { EnvironmentDrawerTab } from "../tabs";
import { useCreateOverridePolicy } from "./useOverridePolicy";

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type Policy = NonNullable<
  NonNullable<RouterOutputs["environment"]["byId"]>["policy"]
>;

type CreateOverrideProps = {
  environment: SCHEMA.Environment;
  activeTab: EnvironmentDrawerTab;
  deployments: Deployment[];
};

const DEFAULT_ENVIRONMENT_POLICY: Policy = {
  id: "",
  name: "",
  description: null,
  systemId: "",
  environmentId: null,
  approvalRequirement: "manual",
  successType: "all",
  successMinimum: 0,
  concurrencyLimit: null,
  rolloutDuration: 0,
  minimumReleaseInterval: 0,
  releaseSequencing: "wait",
  releaseChannels: [],
  releaseWindows: [],
  isOverride: true,
};

export const CreateOverride: React.FC<CreateOverrideProps> = ({
  environment,
  activeTab,
  deployments,
}) => {
  const { onCreate, isCreating } = useCreateOverridePolicy(environment);

  return (
    <>
      {activeTab === EnvironmentDrawerTab.Approval && (
        <ApprovalAndGovernance
          environmentPolicy={DEFAULT_ENVIRONMENT_POLICY}
          onUpdate={onCreate}
          isLoading={isCreating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Concurrency && (
        <DeploymentControl
          environmentPolicy={DEFAULT_ENVIRONMENT_POLICY}
          onUpdate={onCreate}
          isLoading={isCreating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Management && (
        <ReleaseManagement
          environmentPolicy={DEFAULT_ENVIRONMENT_POLICY}
          onUpdate={onCreate}
          isLoading={isCreating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.ReleaseChannels && (
        <ReleaseChannels
          environmentPolicy={DEFAULT_ENVIRONMENT_POLICY}
          onUpdate={onCreate}
          isLoading={isCreating}
          deployments={deployments}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Rollout && (
        <RolloutAndTiming
          environmentPolicy={DEFAULT_ENVIRONMENT_POLICY}
          onUpdate={onCreate}
          isLoading={isCreating}
        />
      )}
    </>
  );
};
