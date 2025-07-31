"use client";

import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { formatDistanceToNowStrict, isAfter } from "date-fns";
import prettyMilliseconds from "pretty-ms";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import type { RolloutInfo } from "./rollout";
import { RolloutTypeToOffsetFunction } from "~/app/[workspaceSlug]/(app)/policies/[policyId]/edit/rollouts/_components/equations";
import { api } from "~/trpc/react";
import { useRolloutDrawer } from "../useRolloutDrawer";
import { getCurrentRolloutPosition } from "./rollout";

const PrettyYAxisTick = (props: any) => {
  const { payload } = props;
  const { value } = payload;

  const minutes = Number.parseFloat(value);
  const ms = Math.round(minutes * 60_000);

  const prettyString = prettyMilliseconds(ms, {
    unitCount: 2,
    compact: true,
    verbose: false,
  });

  return (
    <g>
      <text {...props} fontSize={14} dy={5}>
        {prettyString}
      </text>
    </g>
  );
};

const getRolloutTimeMessage = (rolloutTime: Date | null) => {
  if (rolloutTime == null) return "Rollout not started";

  const now = new Date();
  const isInFuture = isAfter(rolloutTime, now);

  const distanceToNow = formatDistanceToNowStrict(rolloutTime, {
    addSuffix: true,
  });
  if (isInFuture) return `Version rolls out in ${distanceToNow}`;

  return `Version rolled out ${distanceToNow}`;
};

const PrettyTooltip = (
  props: TooltipProps<ValueType, NameType> & {
    rolloutInfoList: RolloutInfo["releaseTargetRolloutInfo"];
  },
) => {
  const { label: position } = props;

  const releaseTarget = props.rolloutInfoList.at(Number(position));

  if (releaseTarget == null) return null;

  const resourceName = releaseTarget.resource.name;
  const rolloutTimeMessage = getRolloutTimeMessage(releaseTarget.rolloutTime);

  return (
    <div className="rounded-md border bg-neutral-900 p-2 text-sm">
      <p>Resource: {resourceName}</p>
      <p>Rollout position: {position}</p>
      <p>{rolloutTimeMessage}</p>
    </div>
  );
};

const RolloutCurve: React.FC<{
  chartData: { x: number; y: number }[];
  currentRolloutPosition: number;
  rolloutInfoList: RolloutInfo["releaseTargetRolloutInfo"];
}> = ({ chartData, currentRolloutPosition, rolloutInfoList }) => {
  const { releaseTargetId } = useRolloutDrawer();
  const releaseTarget = rolloutInfoList.find(
    (info) => info.id === releaseTargetId,
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <XAxis
            dataKey="x"
            label={{
              value: "Rollout position",
              dy: 20,
            }}
            tick={{ fontSize: 14 }}
          />
          <YAxis
            label={{
              value: "Time (minutes)",
              angle: -90,
              dx: -20,
            }}
            tick={PrettyYAxisTick}
          />
          <Line type="monotone" dataKey="y" stroke="#8884d8" dot={false} />
          {currentRolloutPosition !==
            Number(releaseTarget?.rolloutPosition ?? 0) && (
            <ReferenceLine
              x={currentRolloutPosition}
              stroke="#22c55e"
              strokeWidth={2}
            />
          )}
          {releaseTarget != null && (
            <ReferenceLine
              x={Number(releaseTarget.rolloutPosition)}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `${releaseTarget.resource.name}${currentRolloutPosition === Number(releaseTarget.rolloutPosition) ? " (current)" : ""}`,
                position: "top",
                fill: "#9ca3af",
                fontSize: 12,
              }}
            />
          )}
          <Tooltip
            content={(props) => PrettyTooltip({ ...props, rolloutInfoList })}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const RolloutCurveChart: React.FC<{
  environmentId: string;
  versionId: string;
}> = ({ environmentId, versionId }) => {
  const { data: rolloutInfo } = api.policy.rollout.list.useQuery(
    { environmentId, versionId },
    { refetchInterval: 10_000 },
  );

  const rolloutPolicy = rolloutInfo?.rolloutPolicy;
  const numReleaseTargets = rolloutInfo?.releaseTargetRolloutInfo.length ?? 0;

  const rolloutType =
    rolloutPolicy?.environmentVersionRollout?.rolloutType ?? "linear";
  const timeScaleInterval =
    rolloutPolicy?.environmentVersionRollout?.timeScaleInterval ?? 0;
  const positionGrowthFactor =
    rolloutPolicy?.environmentVersionRollout?.positionGrowthFactor ?? 1;

  const offsetFunction = RolloutTypeToOffsetFunction[rolloutType](
    positionGrowthFactor,
    timeScaleInterval,
    numReleaseTargets,
  );

  const chartData = Array.from({ length: numReleaseTargets }, (_, i) => ({
    x: i + 1,
    y: offsetFunction(i),
  }));

  const currentRolloutPosition = getCurrentRolloutPosition(
    rolloutInfo?.releaseTargetRolloutInfo ?? [],
  );

  return (
    <Card className="rounded-md p-2">
      <CardHeader>
        <CardTitle>Rollout curve</CardTitle>
        <CardDescription>
          View the rollout curve for the deployment.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <RolloutCurve
          chartData={chartData}
          currentRolloutPosition={Number(currentRolloutPosition)}
          rolloutInfoList={rolloutInfo?.releaseTargetRolloutInfo ?? []}
        />
      </CardContent>
    </Card>
  );
};
