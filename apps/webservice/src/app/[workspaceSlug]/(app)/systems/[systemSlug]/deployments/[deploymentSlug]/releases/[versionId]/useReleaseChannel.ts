import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import _ from "lodash";

import {
  ColumnOperator,
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { ReleaseFilterType } from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";

export const useReleaseChannel = (
  deploymentId: string,
  environmentId: string,
  releaseVersion: string,
  enabled = true,
) => {
  const environment = api.environment.byId.useQuery(environmentId, { enabled });
  const envReleaseChannel = environment.data?.releaseChannels.find(
    (rc) => rc.deploymentId === deploymentId,
  );
  const policyReleaseChannel = environment.data?.policy.releaseChannels.find(
    (prc) => prc.deploymentId === deploymentId,
  );
  const rcId = envReleaseChannel?.id ?? policyReleaseChannel?.id ?? null;
  const { releaseFilter: filter } = envReleaseChannel ??
    policyReleaseChannel ?? { releaseFilter: null };

  const versionFilter: ReleaseCondition = {
    type: ReleaseFilterType.Version,
    operator: ColumnOperator.Equals,
    value: releaseVersion,
  };

  const releaseFilter: ReleaseCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: _.compact([versionFilter, filter]),
  };

  const releasesQ = api.release.list.useQuery(
    { deploymentId, filter: releaseFilter, limit: 0 },
    { enabled: filter != null && enabled },
  );

  const hasReleaseChannel = rcId != null;
  const isReleaseChannelMatchingFilter =
    filter == null ||
    (releasesQ.data?.total != null && releasesQ.data.total > 0);

  const loading = environment.isLoading || releasesQ.isLoading;

  const isPassingReleaseChannel =
    !hasReleaseChannel || isReleaseChannelMatchingFilter;

  return { isPassingReleaseChannel, loading };
};
