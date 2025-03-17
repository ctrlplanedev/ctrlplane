"use client";

import _ from "lodash";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { api } from "~/trpc/react";

export const VersionDistributionBarChart: React.FC<{
  deploymentId: string;
  showPreviousVersionDistro: number;
}> = ({ deploymentId, showPreviousVersionDistro }) => {
  const versions = api.deployment.version.list.useQuery(
    { deploymentId },
    { refetchInterval: 10_000 },
  );
  const distribution = api.deployment.distributionById.useQuery(deploymentId, {
    refetchInterval: 2_000,
  });

  const distro = _.chain(versions.data?.items ?? [])
    .map((v) => ({
      version: v.tag,
      count: (distribution.data ?? []).filter((d) => d.version.id === v.id)
        .length,
    }))
    .take(showPreviousVersionDistro)
    .value();
  const distroPadding = _.range(showPreviousVersionDistro - distro.length).map(
    () => ({ version: "", count: 0 }),
  );

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={[...distro, ...distroPadding]}
        margin={{ bottom: -40, top: 30, right: 20, left: -10 }}
      >
        <XAxis
          dataKey="version"
          type="category"
          interval={0}
          height={100}
          style={{ fontSize: "0.75rem" }}
          angle={-45}
          textAnchor="end"
        />
        <YAxis style={{ fontSize: "0.75rem" }} dataKey="count" />
        <Bar dataKey="count" fill="#8884d8"></Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
