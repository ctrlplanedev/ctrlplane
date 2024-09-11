"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

export const DistroBarChart: React.FC<{
  distro: Array<{
    version: string;
    count: number;
  }>;
  distroPadding: Array<{
    version: string;
    count: number;
  }>;
}> = ({ distro, distroPadding }) => (
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
