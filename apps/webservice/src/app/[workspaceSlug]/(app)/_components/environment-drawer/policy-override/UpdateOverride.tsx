import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";

import { ApprovalAndGovernance } from "../../policy-form-components/ApprovalAndGovernance";
import { DeploymentControl } from "../../policy-form-components/DeploymentControl";
import { ReleaseChannels } from "../../policy-form-components/ReleaseChannels";
import { ReleaseManagement } from "../../policy-form-components/ReleaseManagement";
import { RolloutAndTiming } from "../../policy-form-components/RolloutAndTiming";
import { EnvironmentDrawerTab } from "../tabs";
import { useUpdateOverridePolicy } from "./useOverridePolicy";

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.ReleaseChannel[];
};

type Policy = NonNullable<
  NonNullable<RouterOutputs["environment"]["byId"]>["policy"]
>;

type UpdateOverrideProps = {
  environment: SCHEMA.Environment;
  environmentPolicy: Policy;
  activeTab: EnvironmentDrawerTab;
  deployments: Deployment[];
};

export const UpdateOverride: React.FC<UpdateOverrideProps> = ({
  environment,
  environmentPolicy,
  activeTab,
  deployments,
}) => {
  const { onUpdate, isUpdating } = useUpdateOverridePolicy(
    environment,
    environmentPolicy,
  );

  return (
    <>
      {activeTab === EnvironmentDrawerTab.Approval && (
        <ApprovalAndGovernance
          environmentPolicy={environmentPolicy}
          onUpdate={onUpdate}
          isLoading={isUpdating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Concurrency && (
        <DeploymentControl
          environmentPolicy={environmentPolicy}
          onUpdate={onUpdate}
          isLoading={isUpdating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Management && (
        <ReleaseManagement
          environmentPolicy={environmentPolicy}
          onUpdate={onUpdate}
          isLoading={isUpdating}
        />
      )}
      {activeTab === EnvironmentDrawerTab.ReleaseChannels && (
        <ReleaseChannels
          environmentPolicy={environmentPolicy}
          onUpdate={onUpdate}
          isLoading={isUpdating}
          deployments={deployments}
        />
      )}
      {activeTab === EnvironmentDrawerTab.Rollout && (
        <RolloutAndTiming
          environmentPolicy={environmentPolicy}
          onUpdate={onUpdate}
          isLoading={isUpdating}
        />
      )}
    </>
  );
};
