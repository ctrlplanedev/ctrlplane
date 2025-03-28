"use client";

import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { useParams, useRouter } from "next/navigation";
import LZString from "lz-string";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import colors from "tailwindcss/colors";

import { ChartTooltip } from "@ctrlplane/ui/chart";
import {
  ColumnOperator,
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import { ResourceConditionType } from "@ctrlplane/validators/resources";

import { urls } from "~/app/urls";

const COLORS = [
  colors.blue[500],
  colors.green[500],
  colors.yellow[500],
  colors.red[500],
  colors.purple[500],
  colors.amber[500],
  colors.cyan[500],
  colors.fuchsia[500],
  colors.lime[500],
  colors.orange[500],
  colors.pink[500],
  colors.teal[500],
];

export const ResourceKindPieChart: React.FC<{
  kindDistro: {
    kind: string;
    percentage: number;
  }[];
  resourceSelector: ResourceCondition | null;
  resourceCount: number;
}> = ({ kindDistro, resourceSelector, resourceCount }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const router = useRouter();
  const resourcesUrl = urls.workspace(workspaceSlug).resources().list();
  const prettyResourceCount = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(resourceCount);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <ChartTooltip
          content={({ active, payload }) => {
            if (active && payload?.length) {
              return (
                <div className="flex items-center gap-4 rounded-lg border bg-background p-2 text-xs shadow-sm">
                  <div className="font-semibold">{payload[0]?.name}</div>
                  <div className="text-sm text-neutral-400">
                    {payload[0]?.value}%
                  </div>
                </div>
              );
            }
          }}
        />
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-xl font-semibold"
        >
          {prettyResourceCount}
        </text>
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current text-xs text-neutral-300"
        >
          total resources
        </text>
        <Pie
          data={kindDistro}
          dataKey="percentage"
          nameKey="kind"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={60}
          strokeWidth={1}
          animationEasing="ease"
          animationDuration={500}
          isAnimationActive
          activeShape={(props: any) => (
            <g>
              <Sector {...props} outerRadius={props.outerRadius + 5} />
            </g>
          )}
          label={({ kind, percent }: { kind: string; percent: number }) =>
            percent > 0.05
              ? `${kind.length > 12 ? `${kind.substring(0, 12)}...` : kind}`
              : ""
          }
          stroke={colors.neutral[950]}
        >
          {kindDistro.map(({ kind }, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              className="cursor-pointer focus:outline-none"
              onClick={() => {
                if (resourceSelector == null) return;
                const kindCondition: ResourceCondition = {
                  type: ResourceConditionType.Kind,
                  operator: ColumnOperator.Equals,
                  value: kind,
                };
                const selector: ResourceCondition = {
                  type: ConditionType.Comparison,
                  operator: ComparisonOperator.And,
                  conditions: [resourceSelector, kindCondition],
                };
                const hash = LZString.compressToEncodedURIComponent(
                  JSON.stringify(selector),
                );
                router.push(`${resourcesUrl}?filter=${hash}`);
              }}
            />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};
