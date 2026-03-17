import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartConfig } from "~/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "~/components/ui/chart";
import { Skeleton } from "~/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  claimed: "hsl(200, 80%, 55%)",
  pending: "hsl(45, 90%, 55%)",
  expired: "hsl(0, 75%, 55%)",
  scheduled: "hsl(160, 60%, 45%)",
};

const KIND_PALETTE = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 65%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 65%, 55%)",
  "hsl(190, 70%, 50%)",
  "hsl(100, 55%, 45%)",
  "hsl(50, 75%, 50%)",
];

const ERROR_COLORS: Record<string, string> = {
  clean: "hsl(160, 60%, 45%)",
  errored: "hsl(0, 75%, 55%)",
};

const ATTEMPT_COLORS: Record<string, string> = {
  "0": "hsl(160, 60%, 45%)",
  "1": "hsl(200, 70%, 55%)",
  "2-5": "hsl(45, 85%, 55%)",
  "6+": "hsl(0, 75%, 55%)",
};

interface ChartData {
  byPriority: { priority: number; count: number }[];
  byClaimStatus: { status: string; count: number }[];
  byKind: { kind: string; count: number }[];
  scopeErrors: { hasError: boolean; count: number }[];
  scopeAttempts: { bucket: string; count: number }[];
}

function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center rounded-lg border bg-card p-4">
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

function ClaimStatusChart({ data }: { data: ChartData["byClaimStatus"] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        data.map((d) => [
          d.status,
          {
            label: d.status.charAt(0).toUpperCase() + d.status.slice(1),
            color: STATUS_COLORS[d.status] ?? "hsl(0,0%,50%)",
          },
        ]),
      ),
    [data],
  );

  if (total === 0) return <EmptyChart label="Claim Status" />;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Claim Status</p>
      <ChartContainer
        config={config}
        className="mx-auto aspect-square max-h-[220px]"
      >
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="status" hideLabel />}
          />
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            innerRadius={50}
            outerRadius={80}
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell
                key={d.status}
                fill={STATUS_COLORS[d.status] ?? "hsl(0,0%,50%)"}
              />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox)
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {total}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        scopes
                      </tspan>
                    </text>
                  );
              }}
            />
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="status" />} />
        </PieChart>
      </ChartContainer>
    </div>
  );
}

function KindDistributionChart({ data }: { data: ChartData["byKind"] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        data.map((d, i) => [
          d.kind,
          { label: d.kind, color: KIND_PALETTE[i % KIND_PALETTE.length] },
        ]),
      ),
    [data],
  );

  if (total === 0) return <EmptyChart label="By Kind" />;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-sm font-medium">By Kind</p>
      <ChartContainer
        config={config}
        className="mx-auto aspect-square max-h-[220px]"
      >
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent nameKey="kind" hideLabel />}
          />
          <Pie
            data={data}
            dataKey="count"
            nameKey="kind"
            innerRadius={50}
            outerRadius={80}
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell
                key={d.kind}
                fill={KIND_PALETTE[i % KIND_PALETTE.length]}
              />
            ))}
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox)
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-2xl font-bold"
                      >
                        {data.length}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 20}
                        className="fill-muted-foreground text-xs"
                      >
                        kinds
                      </tspan>
                    </text>
                  );
              }}
            />
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="kind" />} />
        </PieChart>
      </ChartContainer>
    </div>
  );
}

function PriorityChart({ data }: { data: ChartData["byPriority"] }) {
  const config: ChartConfig = {
    count: { label: "Scopes", color: "hsl(220, 70%, 55%)" },
  };

  if (data.length === 0) return <EmptyChart label="By Priority" />;

  const chartData = data.map((d) => ({
    priority: `P${d.priority}`,
    count: d.count,
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-sm font-medium">By Priority</p>
      <ChartContainer config={config} className="max-h-[220px]">
        <BarChart data={chartData} margin={{ left: -10 }}>
          <XAxis dataKey="priority" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function ScopeHealthChart({
  errors,
  attempts,
}: {
  errors: ChartData["scopeErrors"];
  attempts: ChartData["scopeAttempts"];
}) {
  const errorData = useMemo(
    () =>
      errors.map((d) => ({
        label: d.hasError ? "errored" : "clean",
        count: d.count,
      })),
    [errors],
  );

  const errorConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        errorData.map((d) => [
          d.label,
          {
            label: d.label.charAt(0).toUpperCase() + d.label.slice(1),
            color: ERROR_COLORS[d.label] ?? "hsl(0,0%,50%)",
          },
        ]),
      ),
    [errorData],
  );

  const attemptConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        attempts.map((d) => [
          d.bucket,
          {
            label: `${d.bucket} attempts`,
            color: ATTEMPT_COLORS[d.bucket] ?? "hsl(0,0%,50%)",
          },
        ]),
      ),
    [attempts],
  );

  const totalScopes = errorData.reduce((sum, d) => sum + d.count, 0);

  if (totalScopes === 0) return <EmptyChart label="Scope Health" />;

  const attemptData = attempts.map((d) => ({
    bucket: d.bucket,
    count: d.count,
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-2 text-sm font-medium">Scope Health</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-center text-xs text-muted-foreground">
            Error Rate
          </p>
          <ChartContainer
            config={errorConfig}
            className="mx-auto aspect-square max-h-[180px]"
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent nameKey="label" hideLabel />}
              />
              <Pie
                data={errorData}
                dataKey="count"
                nameKey="label"
                innerRadius={35}
                outerRadius={60}
                strokeWidth={2}
              >
                {errorData.map((d) => (
                  <Cell
                    key={d.label}
                    fill={ERROR_COLORS[d.label] ?? "hsl(0,0%,50%)"}
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      const errorCount =
                        errorData.find((d) => d.label === "errored")?.count ??
                        0;
                      const pct =
                        totalScopes > 0
                          ? Math.round((errorCount / totalScopes) * 100)
                          : 0;
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-lg font-bold"
                          >
                            {pct}%
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="label" />} />
            </PieChart>
          </ChartContainer>
        </div>
        <div>
          <p className="mb-1 text-center text-xs text-muted-foreground">
            Attempt Distribution
          </p>
          <ChartContainer config={attemptConfig} className="max-h-[180px]">
            <BarChart data={attemptData} margin={{ left: -10 }}>
              <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {attemptData.map((d) => (
                  <Cell
                    key={d.bucket}
                    fill={ATTEMPT_COLORS[d.bucket] ?? "hsl(0,0%,50%)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-4">
      <p className="mb-2 text-sm font-medium">{label}</p>
      <p className="py-12 text-sm text-muted-foreground">No data available</p>
    </div>
  );
}

export function WorkQueueCharts({
  data,
  isLoading,
}: {
  data?: ChartData;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <ClaimStatusChart data={data.byClaimStatus} />
      <KindDistributionChart data={data.byKind} />
      <PriorityChart data={data.byPriority} />
      <ScopeHealthChart
        errors={data.scopeErrors}
        attempts={data.scopeAttempts}
      />
    </div>
  );
}
