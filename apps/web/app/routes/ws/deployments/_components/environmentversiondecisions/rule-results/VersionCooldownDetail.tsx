import type { AppRouter } from "@ctrlplane/trpc";
import { useMemo } from "react";
import _ from "lodash";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  FastForwardIcon,
  Loader2Icon,
} from "lucide-react";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";
import {
  safeFormatDistanceToNowStrict,
  safeIsFuture,
} from "~/lib/date";

type CooldownEvaluation = NonNullable<
  Awaited<ReturnType<AppRouter["deploymentVersions"]["evaulate"]>>
>[number];

type CooldownDetails = {
  reason?: string;
  time_remaining?: string;
  time_elapsed?: string;
  required_interval?: string;
  next_deployment_time?: string;
  reference_version_tag?: string;
  reference_source?: string;
};

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
      for (const rule of policy.versionCooldownRules) {
        map.set(rule.id, policy.name);
      }
    }
    return map;
  }, [policies]);
}

function summarizeReasons(rules: CooldownEvaluation[]): {
  reason: string;
  details: Partial<CooldownDetails>;
} {
  const reasons = _.countBy(
    rules,
    (r) => (r.details as Partial<CooldownDetails>).reason ?? "unknown",
  );
  const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0] ?? "unknown";
  const representative = rules.find(
    (r) => (r.details as Partial<CooldownDetails>).reason === dominant,
  );
  return {
    reason: dominant,
    details: (representative?.details ?? {}) as Partial<CooldownDetails>,
  };
}

function CooldownDescription({
  rules,
  allPassed,
}: {
  rules: CooldownEvaluation[];
  allPassed: boolean;
}) {
  const { reason, details } = summarizeReasons(
    allPassed ? rules : rules.filter((r) => !r.allowed),
  );

  if (allPassed) {
    if (reason === "first_deployment")
      return <>No version change yet · nothing to cool down from</>;
    if (reason === "same_version_redeploy")
      return <>Redeploying same version · cooldown only applies to changes</>;

    if (reason === "cooldown_passed" && details.time_elapsed != null)
      return (
        <>
          {details.time_elapsed} elapsed
          {details.required_interval != null &&
            ` of ${details.required_interval}`}
        </>
      );
    return null;
  }

  const denied = rules.filter((r) => !r.allowed);
  const earliest = getEarliestNextDeployment(denied);

  if (reason === "cooldown_failed") {
    return (
      <>
        {details.time_remaining} remaining
        {details.required_interval != null &&
          ` of ${details.required_interval}`}
        {earliest != null && safeIsFuture(earliest) && (
          <>
            {" "}
            · deploys in {safeFormatDistanceToNowStrict(earliest) ?? "?"}
          </>
        )}
      </>
    );
  }

  if (earliest != null && safeIsFuture(earliest))
    return <>next in {safeFormatDistanceToNowStrict(earliest) ?? "?"}</>;

  return null;
}

function getEarliestNextDeployment(rules: CooldownEvaluation[]): Date | null {
  let earliest: Date | null = null;
  for (const rule of rules) {
    const details = rule.details as Partial<CooldownDetails>;
    if (details.next_deployment_time == null) continue;
    const date = new Date(details.next_deployment_time);
    if (isNaN(date.getTime())) continue;
    if (earliest == null || date < earliest) earliest = date;
  }
  return earliest;
}

function CooldownRow({
  rules,
  policyName,
  isSkipped,
}: {
  rules: CooldownEvaluation[];
  policyName: string | undefined;
  isSkipped: boolean;
}) {
  const total = rules.length;
  const completed = rules.filter((r) => r.allowed).length;
  const allPassed = completed === total && total > 0;
  const allDenied = completed === 0;

  const label = policyName ?? "Version Cooldown";

  if (isSkipped)
    return (
      <div className="flex w-full items-center gap-2 opacity-60">
        <div className="flex grow items-center gap-2">
          <FastForwardIcon className="size-3 text-muted-foreground" />
          <span className="line-through">{label}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">Skipped</span>
      </div>
    );

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex grow items-center gap-2">
        {allPassed ? (
          <CheckCircle2Icon className="size-3 text-green-500" />
        ) : allDenied ? (
          <CircleAlertIcon className="size-3 text-amber-500" />
        ) : (
          <Loader2Icon className="size-3 animate-spin text-blue-500" />
        )}
        <span>{label}</span>
        {!allPassed && total > 1 && (
          <span>
            ({completed}/{total})
          </span>
        )}
      </div>
      <span className="shrink-0 text-muted-foreground">
        <CooldownDescription rules={rules} allPassed={allPassed} />
      </span>
    </div>
  );
}

export type VersionCooldownDetailProps = {
  cooldowns: CooldownEvaluation[];
  skippedRuleIds?: Set<string>;
};

export const VersionCooldownDetail: React.FC<VersionCooldownDetailProps> = ({
  cooldowns,
  skippedRuleIds,
}) => {
  const policyNameByRuleId = usePolicyNameByRuleId();
  if (cooldowns.length === 0) return null;

  const grouped = _.groupBy(cooldowns, (r) => r.ruleId);
  return (
    <>
      {Object.entries(grouped).map(([ruleId, ruleGroup]) => (
        <CooldownRow
          key={ruleId}
          rules={ruleGroup}
          policyName={policyNameByRuleId.get(ruleId)}
          isSkipped={skippedRuleIds?.has(ruleId) ?? false}
        />
      ))}
    </>
  );
};
