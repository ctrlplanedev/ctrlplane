import type { RouterOutputs } from "@ctrlplane/api";
import { isAfter } from "date-fns";
import _ from "lodash";

export type RolloutInfo = NonNullable<
  RouterOutputs["policy"]["rollout"]["list"]
>;

export const getCurrentRolloutPosition = (
  rolloutInfoList: RolloutInfo["releaseTargetRolloutInfo"],
) => {
  const hasRolloutStarted = rolloutInfoList.some(
    (info) => info.rolloutTime != null,
  );
  if (!hasRolloutStarted) return 1;

  const now = new Date();
  const next = rolloutInfoList.find(
    (info) => info.rolloutTime != null && isAfter(info.rolloutTime, now),
  );

  return next == null ? rolloutInfoList.length : next.rolloutPosition;
};
