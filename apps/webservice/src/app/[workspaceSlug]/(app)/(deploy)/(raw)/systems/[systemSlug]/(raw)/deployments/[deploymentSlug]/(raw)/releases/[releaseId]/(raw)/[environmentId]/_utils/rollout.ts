import type { RouterOutputs } from "@ctrlplane/api";
import { isAfter } from "date-fns";

export type RolloutInfo = RouterOutputs["policy"]["rollout"]["list"];

export const getCurrentRolloutPosition = (
  rolloutInfoList: RolloutInfo["releaseTargetRolloutInfo"],
) => {
  const now = new Date();
  const next = rolloutInfoList.find(
    (info) => info.rolloutTime != null && isAfter(info.rolloutTime, now),
  );

  if (next == null) return null;

  return next.rolloutPosition;
};
