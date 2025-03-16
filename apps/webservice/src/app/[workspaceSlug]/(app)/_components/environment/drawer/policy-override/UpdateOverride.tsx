import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";

import { ApprovalAndGovernance } from "~/app/[workspaceSlug]/(app)/_components/policy/form/ApprovalAndGovernance";
import { DeploymentControl } from "~/app/[workspaceSlug]/(app)/_components/policy/form/DeploymentControl";
import { DeploymentVersionChannels } from "~/app/[workspaceSlug]/(app)/_components/policy/form/DeploymentVersionChannels";
import { ReleaseManagement } from "~/app/[workspaceSlug]/(app)/_components/policy/form/ReleaseManagement";
import { RolloutAndTiming } from "~/app/[workspaceSlug]/(app)/_components/policy/form/RolloutAndTiming";
import { EnvironmentDrawerTab } from "../tabs";
import { useUpdateOverridePolicy } from "./useOverridePolicy";

type Deployment = SCHEMA.Deployment & {
  releaseChannels: SCHEMA.DeploymentVersionChannel[];
};

type Policy = NonNullable<
  NonNullable<RouterOutputs["environment"]["byId"]>["policy"]
>;

type UpdateOverridePolicyProps = {
  environment: SCHEMA.Environment;
  environmentPolicy: Policy;
  activeTab: EnvironmentDrawerTab | null;
  deployments: Deployment[];
};

export const UpdateOverridePolicy: React.FC<UpdateOverridePolicyProps> = ({
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
      {activeTab === EnvironmentDrawerTab.DeploymentVersionChannels && (
        <DeploymentVersionChannels
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
