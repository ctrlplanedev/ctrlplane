"use client";

import { useParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";
import { getCurrentRolloutPosition } from "../_utils/rollout";

export const RolloutPercentCard: React.FC = () => {
  const { releaseId: versionId, environmentId } = useParams<{
    releaseId: string;
    environmentId: string;
  }>();

  const { data: rolloutInfo } = api.policy.rollout.list.useQuery(
    { environmentId, versionId },
    { refetchInterval: 10_000 },
  );

  const currentRolloutPosition =
    getCurrentRolloutPosition(rolloutInfo?.releaseTargetRolloutInfo ?? []) ?? 0;

  const maxPosition = rolloutInfo?.releaseTargetRolloutInfo.length ?? 0;

  const percentComplete =
    maxPosition === 0
      ? 0
      : Math.round((currentRolloutPosition / maxPosition) * 100);

  return (
    <Card className="flex h-full flex-col gap-16 p-4">
      <CardHeader>
        <CardTitle>Rollout progress</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col items-center justify-between">
        <span className="text-5xl font-bold">{percentComplete}%</span>
        <div className="w-full">
          <div className="mb-2 flex justify-between text-sm text-muted-foreground">
            <span>Progress</span>
            <span>
              {currentRolloutPosition} / {maxPosition}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
