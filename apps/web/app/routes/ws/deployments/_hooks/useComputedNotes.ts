import type { Node } from "reactflow";
import { useCallback, useMemo } from "react";
import type { ReleaseTargetWithState } from "../_components/types";
import _ from "lodash";
import { useSearchParams } from "react-router";

interface Version {
  id: string;
  name: string;
  tag: string;
}

interface UseComputedNodesOptions {
  versions: Version[];
  releaseTargets: ReleaseTargetWithState[];
  environments: { id: string; name: string }[];
  isLoading: boolean;
}

export const useComputedNodes = ({
  versions,
  releaseTargets,
  environments,
  isLoading,
}: UseComputedNodesOptions): Node[] => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEnvironmentId = searchParams.get("env");

  const handleEnvironmentSelect = useCallback(
    (environmentId: string) => {
      setSearchParams(
        selectedEnvironmentId === environmentId ? {} : { env: environmentId },
      );
    },
    [selectedEnvironmentId, setSearchParams],
  );

  return useMemo(() => {
    if (versions.length === 0) return [];

    const firstVersion = versions[0];

    const releaseTargetsByEnv = _.groupBy(
      releaseTargets,
      (rt) => rt.releaseTarget.environmentId,
    );

    return [
      {
        id: "version-source",
        type: "version",
        position: { x: 50, y: 150 },
        data: firstVersion,
      },
      ...environments.map((environment) => {
        const envReleaseTargets = releaseTargetsByEnv[environment.id] ?? [];

        const currentVersionCounts: Record<string, number> = {};
        envReleaseTargets.forEach((rt) => {
          const versionId = rt.currentVersion?.id;
          if (versionId) {
            currentVersionCounts[versionId] =
              (currentVersionCounts[versionId] ?? 0) + 1;
          }
        });

        const desiredVersionCounts: Record<string, number> = {};
        envReleaseTargets.forEach((rt) => {
          const versionId = rt.desiredVersion?.id;
          if (versionId) {
            desiredVersionCounts[versionId] =
              (desiredVersionCounts[versionId] ?? 0) + 1;
          }
        });

        const currentVersionsWithCounts = Object.entries(currentVersionCounts)
          .map(([id, count]) => ({
            name: versions.find((v) => v.id === id)?.name ?? id,
            tag: versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        const desiredVersionsWithCounts = Object.entries(desiredVersionCounts)
          .map(([id, count]) => ({
            name: versions.find((v) => v.id === id)?.name ?? id,
            tag: versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        const jobs = envReleaseTargets
          .map((rt) => rt.latestJob)
          .filter((job): job is NonNullable<typeof job> => job != null);

        return {
          id: environment.id,
          type: "environment",
          position: { x: 0, y: 0 },
          data: {
            id: environment.id,
            name: environment.name,
            resourceCount: envReleaseTargets.length,
            jobs,
            currentVersionsWithCounts,
            desiredVersionsWithCounts,
            isLoading,
            onSelect: () => handleEnvironmentSelect(environment.id),
          },
        };
      }),
    ];
  }, [versions, releaseTargets, environments, isLoading, handleEnvironmentSelect]);
};
