import type { TooltipProps } from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import React, { useState } from "react";
import prettyMilliseconds from "pretty-ms";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import * as schema from "@ctrlplane/db/schema";
import { Input } from "@ctrlplane/ui/input";
import { toast } from "@ctrlplane/ui/toast";

import { usePolicyContext } from "../PolicyContext";
import { RolloutTypeToOffsetFunction } from "./equations";

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

const PrettyTooltip = (props: TooltipProps<ValueType, NameType>) => {
  const { payload } = props;
  const position = payload?.[0]?.payload?.x;
  const time = Math.round(payload?.[0]?.payload?.y);
  const timeMs = time * 60_000;
  const timePretty = Number.isNaN(timeMs)
    ? "0 minutes"
    : prettyMilliseconds(timeMs, { verbose: true });

  return (
    <div className="rounded-md border bg-neutral-900 p-2 text-sm">
      <p>Rollout position: {position}</p>
      <p>Time: {timePretty}</p>
    </div>
  );
};

const NumResourcesInput: React.FC<{
  value: number;
  setValue: (value: number) => void;
}> = ({ value, setValue }) => (
  <Input
    type="number"
    value={value}
    onChange={(e) => {
      const { valueAsNumber } = e.target;
      if (Number.isNaN(valueAsNumber)) {
        toast.error("Invalid number of resources for preview widget");
        return;
      }
      setValue(valueAsNumber);
    }}
    min={1}
    className="w-24"
  />
);

const RolloutCurveChart: React.FC<{
  numResources: number;
}> = ({ numResources }) => {
  const { form } = usePolicyContext();
  const rolloutType =
    form.watch("environmentVersionRollout.rolloutType") ?? "linear";
  const positionGrowthFactor =
    form.watch("environmentVersionRollout.positionGrowthFactor") ?? 1;
  const timeScaleInterval = form.watch(
    "environmentVersionRollout.timeScaleInterval",
  );

  const dbRolloutType =
    schema.apiRolloutTypeToDBRolloutType[rolloutType] ??
    schema.RolloutType.Linear;

  const offsetFunction = RolloutTypeToOffsetFunction[dbRolloutType](
    positionGrowthFactor,
    timeScaleInterval,
    numResources,
  );

  const chartData = Array.from({ length: numResources }, (_, i) => ({
    x: i,
    y: offsetFunction(i),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={chartData}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <XAxis
          dataKey="x"
          label={{
            value: "Rollout position (0-indexed)",
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
        <Tooltip content={PrettyTooltip} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const RolloutPreview: React.FC = () => {
  const { form } = usePolicyContext();
  const [numResources, setNumResources] = useState<number>(10);

  const environmentVersionRollout = form.watch("environmentVersionRollout");
  if (!environmentVersionRollout) return null;

  return (
    <div className="flex w-1/2 flex-col gap-4">
      <h2 className="text-lg font-medium">Preview Rollout</h2>
      <div className="flex items-center gap-2">
        <span className="text-nowrap text-sm text-muted-foreground">
          Number of resources:{" "}
        </span>
        <NumResourcesInput value={numResources} setValue={setNumResources} />
      </div>
      <div className="rounded-md border p-4">
        <RolloutCurveChart numResources={numResources} />
      </div>
    </div>
  );
};
