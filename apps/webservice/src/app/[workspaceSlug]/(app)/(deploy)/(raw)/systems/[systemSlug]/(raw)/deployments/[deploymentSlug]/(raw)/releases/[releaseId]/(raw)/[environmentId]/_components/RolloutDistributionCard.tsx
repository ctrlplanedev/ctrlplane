"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

import { RolloutPieChart } from "./RolloutPieChart";

export const RolloutDistributionCard: React.FC<{ deploymentId: string }> = (
  props,
) => {
  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle>Version distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex w-full flex-col gap-4 p-4">
        <RolloutPieChart {...props} />
      </CardContent>
    </Card>
  );
};
