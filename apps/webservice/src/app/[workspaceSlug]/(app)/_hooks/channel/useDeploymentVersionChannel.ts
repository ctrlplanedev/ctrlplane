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
  const { versionSelector } = policyDeploymentVersionChannel ?? {
    versionSelector: null,
  };

  const tagSelector: DeploymentVersionCondition = {
    type: DeploymentVersionConditionType.Version,
    operator: ColumnOperator.Equals,
    value: versionTag,
  };

  const selector: DeploymentVersionCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: _.compact([tagSelector, versionSelector]),
  };

  const versionsQ = api.deployment.version.list.useQuery(
    { deploymentId, selector, limit: 0 },
    { enabled: versionSelector != null && enabled },
  );

  const hasDeploymentVersionChannel = rcId != null;
  const isDeploymentVersionChannelMatchingSelector =
    versionSelector == null ||
    (versionsQ.data?.total != null && versionsQ.data.total > 0);

  const loading = environment.isLoading || versionsQ.isLoading;

  const isPassingDeploymentVersionChannel =
    !hasDeploymentVersionChannel || isDeploymentVersionChannelMatchingSelector;

  return {
    isPassingDeploymentVersionChannel,
    deploymentVersionChannelId: rcId,
    loading,
  };
};
