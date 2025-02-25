"use client";

import { capitalCase } from "change-case";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { getStatusColor } from "~/app/[workspaceSlug]/(appv2)/systems/[systemSlug]/_utils/status-color";

export const DeploymentBarChart: React.FC<{
  data: { name: string; count: number }[];
}> = ({ data }) => (
  <ResponsiveContainer width="100%" height={250}>
    <BarChart data={data} margin={{ top: 10, left: -25, bottom: -10 }}>
      <XAxis
        dataKey="name"
        type="category"
        interval={0}
        height={100}
        style={{ fontSize: "0.75rem" }}
        angle={-45}
        textAnchor="end"
        tickFormatter={(value) => capitalCase(value as string)}
      />
      <YAxis style={{ fontSize: "0.75rem" }} />
      <Bar dataKey="count" fill="#8884d8">
        {data.map(({ name }) => (
          <Cell key={name} fill={getStatusColor(name)} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);
