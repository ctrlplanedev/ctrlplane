import type { AppRouter } from "@ctrlplane/trpc";
import { useMemo } from "react";
import _ from "lodash";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  FastForwardIcon,
} from "lucide-react";
import { rrulestr } from "rrule";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";
import {
  safeFormatDistanceStrict,
  safeFormatDistanceToNowStrict,
  safeIsPast,
} from "~/lib/date";

type DeploymentWindow = NonNullable<
  Awaited<ReturnType<AppRouter["deploymentVersions"]["evaulate"]>>
>[number];

export type DeploymentWindowDetailProps = {
  windows: DeploymentWindow[];
  skippedRuleIds?: Set<string>;
};

type DeploymentWindowProperties = {
  rrule: string;
  duration_minutes: number;
  next_window_start: string;
  next_window_end: string;
  window_type: string;
};

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return !isNaN(new Date(value).getTime());
}

function parseWindowDetails(
  window: DeploymentWindow,
): DeploymentWindowProperties | null {
  const details = window.details;
  if (details == null || typeof details !== "object") return null;
  const {
    rrule,
    window_type,
    duration_minutes,
    next_window_start,
    next_window_end,
  } = details as Record<string, unknown>;
  if (typeof rrule !== "string") return null;
  if (typeof window_type !== "string") return null;
  if (typeof duration_minutes !== "number") return null;
  if (!isValidDateString(next_window_start)) return null;
  if (!isValidDateString(next_window_end)) return null;
  return {
    rrule,
    window_type,
    duration_minutes,
    next_window_start,
    next_window_end,
  };
}

function usePolicyNameByRuleId(): Map<string, string> {
  const { workspace } = useWorkspace();
  const { data: policies } = trpc.policies.list.useQuery(
    { workspaceId: workspace.id },
    { staleTime: 60_000 },
  );

  return useMemo(() => {
    const map = new Map<string, string>();
    if (policies == null) return map;
    for (const policy of policies) {
      for (const rule of policy.deploymentWindowRules) {
        map.set(rule.id, policy.name);
      }
    }
    return map;
  }, [policies]);
}

function WindowRow({
  window: windowEval,
  details,
  policyName,
  isSkipped,
}: {
  window: DeploymentWindow;
  details: DeploymentWindowProperties;
  policyName: string | undefined;
  isSkipped: boolean;
}) {
  const isAllowWindow = details.window_type === "allow";
  const isOpen = isAllowWindow ? windowEval.allowed : !windowEval.allowed;

  const nextEnd = new Date(details.next_window_end);
  const nextStart = new Date(details.next_window_start);
  const durationMs = details.duration_minutes * 60_000;

  let ruleText: string;
  try {
    ruleText = rrulestr(details.rrule).toText();
  } catch {
    ruleText = details.rrule;
  }

  const windowOpenedAt = isOpen
    ? new Date(nextEnd.getTime() - durationMs)
    : null;
  const timeOpen = safeFormatDistanceToNowStrict(windowOpenedAt);
  const timeRemaining =
    isOpen && !safeIsPast(nextEnd)
      ? safeFormatDistanceToNowStrict(nextEnd)
      : null;
  const totalDuration = safeFormatDistanceStrict(windowOpenedAt, nextEnd);

  const windowLabel =
    policyName ?? (isAllowWindow ? "Allow Window" : "Deny Window");

  if (isSkipped)
    return (
      <div className="flex w-full items-center gap-2 opacity-60">
        <div className="flex grow items-center gap-2">
          <FastForwardIcon className="size-3 text-muted-foreground" />
          <span className="line-through">{windowLabel}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">Skipped</span>
      </div>
    );

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex grow items-center gap-2">
        {isOpen ? (
          <CheckCircle2Icon className="size-3 text-green-500" />
        ) : (
          <CircleAlertIcon className="size-3 text-amber-500" />
        )}
        {isOpen ? (
          <span>
            {windowLabel} Open
            {timeOpen != null &&
              ` (${timeOpen}${totalDuration != null ? ` of ${totalDuration}` : ""})`}
            {timeRemaining != null && ` · closes in ${timeRemaining}`}
            {safeIsPast(nextEnd) &&
              ` · ended ${safeFormatDistanceToNowStrict(nextEnd) ?? "?"} ago`}
          </span>
        ) : (
          <span>
            {windowLabel} Closed · next{" "}
            {safeIsPast(nextStart)
              ? `${safeFormatDistanceToNowStrict(nextStart) ?? "?"} ago`
              : `in ${safeFormatDistanceToNowStrict(nextStart) ?? "?"}`}
          </span>
        )}
      </div>
      <span className="shrink-0 text-muted-foreground">{ruleText}</span>
    </div>
  );
}

export const DeploymentWindowDetail: React.FC<DeploymentWindowDetailProps> = ({
  windows,
  skippedRuleIds,
}) => {
  const policyNameByRuleId = usePolicyNameByRuleId();
  const deploymentWindows = _.groupBy(windows, (w) => w.ruleId);
  return (
    <>
      {Object.entries(deploymentWindows)
        .filter(([_, wins]) => wins.length > 0)
        .map(([ruleId, wins]) => {
          const representative = wins[0];
          const details = parseWindowDetails(representative);
          if (details == null) return null;
          return (
            <WindowRow
              key={ruleId}
              window={representative}
              details={details}
              policyName={policyNameByRuleId.get(ruleId)}
              isSkipped={skippedRuleIds?.has(ruleId) ?? false}
            />
          );
        })}
    </>
  );
};
