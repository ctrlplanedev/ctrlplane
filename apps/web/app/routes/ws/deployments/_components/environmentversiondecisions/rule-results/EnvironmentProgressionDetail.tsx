import type { AppRouter } from "@ctrlplane/trpc";
import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock,
  Loader2Icon,
} from "lucide-react";

import { trpc } from "~/api/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Progress } from "~/components/ui/progress";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";

type RuleEvaluation = NonNullable<
  Awaited<ReturnType<AppRouter["deploymentVersions"]["evaulate"]>>
>[number];

type PerEnvDetail = {
  environment?: { id: string; name: string };
  success_percentage?: number;
  minimum_success_percentage?: number;
  soak_minutes?: number;
  most_recent_success?: string;
  soak_time_remaining_minutes?: number;
};

type ProgressionDetails = {
  dependency_environment_count?: number;
  successful_environments?: number;
  failed_environments?: number;
};

function extractEnvDetails(details: Record<string, unknown>): PerEnvDetail[] {
  const envDetails: PerEnvDetail[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (
      key.startsWith("environment_") &&
      typeof value === "object" &&
      value != null
    )
      envDetails.push(value as PerEnvDetail);
  }
  return envDetails;
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
      for (const rule of policy.environmentProgressionRules) {
        map.set(rule.id, policy.name);
      }
    }
    return map;
  }, [policies]);
}

function SuccessRateStatus({ detail }: { detail: PerEnvDetail }) {
  if (detail.success_percentage == null) return null;
  const minRequired = detail.minimum_success_percentage ?? 100;
  const passed = detail.success_percentage >= minRequired;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {passed ? (
        <CheckCircle2Icon className="size-3 text-green-500" />
      ) : (
        <CircleAlertIcon className="size-3 text-amber-500" />
      )}
      <span>
        Success rate: {detail.success_percentage.toFixed(1)}% (requires{" "}
        {minRequired}%)
      </span>
    </div>
  );
}

function getSoakRemainingMinutes(detail: PerEnvDetail): number | null {
  if (detail.soak_minutes == null) return null;
  if (detail.most_recent_success == null) return null;
  const elapsed =
    (Date.now() - new Date(detail.most_recent_success).getTime()) / (1000 * 60);
  return Math.ceil(detail.soak_minutes - elapsed);
}

function SoakTimeStatus({ detail }: { detail: PerEnvDetail }) {
  if (detail.soak_minutes == null) return null;

  const remainingMinutes = getSoakRemainingMinutes(detail);
  const isSoaking = remainingMinutes != null && remainingMinutes > 0;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isSoaking ? (
        <>
          <Loader2Icon className="size-3 animate-spin" />
          <span>
            Soak time: {remainingMinutes} min remaining of {detail.soak_minutes}{" "}
            min
          </span>
        </>
      ) : (
        <>
          <CheckCircle2Icon className="size-3 text-green-500" />
          <span>Soak time: complete ({detail.soak_minutes} min)</span>
        </>
      )}
    </div>
  );
}

function EnvironmentCard({ detail }: { detail: PerEnvDetail }) {
  const minRequired = detail.minimum_success_percentage ?? 100;
  const passRatePassed =
    detail.success_percentage != null &&
    detail.success_percentage >= minRequired;

  let soakPassed = true;
  if (detail.soak_minutes != null && detail.most_recent_success != null) {
    const elapsed =
      (Date.now() - new Date(detail.most_recent_success).getTime()) /
      (1000 * 60);
    soakPassed = elapsed >= detail.soak_minutes;
  }

  const hasDetails =
    detail.success_percentage != null || detail.soak_minutes != null;
  const passed = hasDetails && passRatePassed && soakPassed;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {passed ? (
          <CheckCircle2Icon className="size-4 text-green-500" />
        ) : (
          <CircleAlertIcon className="size-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">
          {detail.environment?.name ?? "Unknown"}
        </span>
      </div>

      <SuccessRateStatus detail={detail} />
      <SoakTimeStatus detail={detail} />

      {!hasDetails && (
        <div className="text-xs text-muted-foreground">
          No deployments found for this version
        </div>
      )}

      {detail.most_recent_success && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3" />
          <span>
            Last success:{" "}
            {formatDistanceToNowStrict(new Date(detail.most_recent_success))}{" "}
            ago
          </span>
        </div>
      )}
    </div>
  );
}

function StatusSummary({
  label,
  successful,
  total,
  allPassed,
  isPending,
}: {
  label: string;
  successful: number;
  total: number;
  allPassed: boolean;
  isPending: boolean;
}) {
  const percent = total > 0 ? Math.round((successful / total) * 100) : 0;
  return (
    <div className="flex grow items-center gap-2">
      {allPassed ? (
        <CheckCircle2Icon className="size-3 text-green-500" />
      ) : isPending ? (
        <Loader2Icon className="size-3 animate-spin text-blue-500" />
      ) : (
        <CircleAlertIcon className="size-3 text-amber-500" />
      )}
      <span>
        {label}
        {total > 0 && ` (${successful}/${total})`}
      </span>
      {!allPassed && total > 0 && (
        <Progress value={percent} className="h-1.5 w-24" />
      )}
    </div>
  );
}

function DependencyProgressBar({
  successful,
  total,
  allPassed,
}: {
  successful: number;
  total: number;
  allPassed: boolean;
}) {
  const percent = total > 0 ? Math.round((successful / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Dependency Environments</span>
        <span
          className={cn(
            "font-medium",
            allPassed ? "text-green-500" : "text-amber-500",
          )}
        >
          {successful} / {total} passed
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            allPassed ? "bg-green-500" : "bg-amber-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ProgressionRow({
  rule,
  policyName,
}: {
  rule: RuleEvaluation;
  policyName: string | undefined;
}) {
  const details = rule.details as Partial<ProgressionDetails> &
    Record<string, unknown>;
  const envDetails = extractEnvDetails(details);

  const total = details.dependency_environment_count ?? envDetails.length;
  const successful = details.successful_environments ?? 0;
  const percent = total > 0 ? Math.round((successful / total) * 100) : 0;

  const label = policyName ?? "Environment Progression";
  const isPending = rule.actionRequired && !rule.allowed;
  const allPassed = rule.allowed;

  return (
    <Dialog>
      <DialogTrigger className="flex w-full items-center gap-2 rounded-sm p-1 text-left hover:bg-accent">
        <StatusSummary
          label={label}
          successful={successful}
          total={total}
          allPassed={allPassed}
          isPending={isPending}
        />
        {!allPassed && rule.nextEvaluationAt != null && (
          <span className="shrink-0 text-muted-foreground">
            re-check in{" "}
            {formatDistanceToNowStrict(new Date(rule.nextEvaluationAt))}
          </span>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DependencyProgressBar
            successful={successful}
            total={total}
            allPassed={allPassed}
          />

          <div className="text-sm text-muted-foreground">{rule.message}</div>

          {envDetails.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-auto">
              {envDetails.map((env, i) => (
                <EnvironmentCard key={env.environment?.id ?? i} detail={env} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type EnvironmentProgressionDetailProps = {
  rules: RuleEvaluation[];
};

export const EnvironmentProgressionDetail: React.FC<
  EnvironmentProgressionDetailProps
> = ({ rules }) => {
  const policyNameByRuleId = usePolicyNameByRuleId();
  if (rules.length === 0) return null;

  const grouped = _.groupBy(rules, (r) => r.ruleId);
  return (
    <>
      {Object.entries(grouped).map(([ruleId, ruleGroup]) => (
        <ProgressionRow
          key={ruleId}
          rule={ruleGroup[0]!}
          policyName={policyNameByRuleId.get(ruleId)}
        />
      ))}
    </>
  );
};
