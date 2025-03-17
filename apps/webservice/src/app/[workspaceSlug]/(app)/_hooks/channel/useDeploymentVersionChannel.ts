import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import _ from "lodash";

import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { DeploymentVersionConditionType } from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";

export const useDeploymentVersionChannel = (
  deploymentId: string,
  environmentId: string,
  versionTag: string,
  enabled = true,
) => {
  const environment = api.environment.byId.useQuery(environmentId, { enabled });
  const policyDeploymentVersionChannel =
    environment.data?.policy.versionChannels.find(
      (prc) => prc.deploymentId === deploymentId,
    );
  const rcId = policyDeploymentVersionChannel?.id ?? null;
  const { versionSelector: filter } = policyDeploymentVersionChannel ?? {
    versionSelector: null,
  };

  const versionFilter: DeploymentVersionCondition = {
    type: DeploymentVersionConditionType.Version,
    operator: ColumnOperator.Equals,
    value: versionTag,
  };

  const releaseFilter: DeploymentVersionCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: _.compact([versionFilter, filter]),
  };

  const releasesQ = api.deployment.version.list.useQuery(
    { deploymentId, filter: releaseFilter, limit: 0 },
    { enabled: filter != null && enabled },
  );

  const hasDeploymentVersionChannel = rcId != null;
  const isDeploymentVersionChannelMatchingFilter =
    filter == null ||
    (releasesQ.data?.total != null && releasesQ.data.total > 0);

  const loading = environment.isLoading || releasesQ.isLoading;

  const isPassingDeploymentVersionChannel =
    !hasDeploymentVersionChannel || isDeploymentVersionChannelMatchingFilter;

  return {
    isPassingDeploymentVersionChannel,
    deploymentVersionChannelId: rcId,
    loading,
  };
};
