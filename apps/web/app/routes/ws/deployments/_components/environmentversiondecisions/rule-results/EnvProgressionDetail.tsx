import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  Clock,
  Loader2Icon,
} from "lucide-react";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

const passRateDetailSchema = z.object({
  success_percentage: z.number().optional(),
  minimum_success_percentage: z.number().optional(),
});

const soakTimeDetailSchema = z.object({
  soak_minutes: z.number().optional(),
  most_recent_success: z.string().optional(),
  soak_time_remaining_minutes: z.number().optional(),
});

const maxAgeDetailSchema = z.object({
  maximum_age_hours: z.number().optional(),
});

const environmentInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();

const perEnvironmentDetailSchema = passRateDetailSchema
  .merge(soakTimeDetailSchema)
  .merge(maxAgeDetailSchema)
  .extend({
    environment: environmentInfoSchema,
  });

export type PerEnvironmentDetail = z.infer<typeof perEnvironmentDetailSchema>;

export const envProgressionDetailSchema = z.object({
  version_id: z.string(),
  deployment_id: z.string().optional(),
  dependency_environment_count: z.number(),
  environment_count: z.number().optional(),
  successful_environments: z.number().optional(),
  failed_environments: z.number().optional(),
});

export type EnvProgressionDetail = z.infer<typeof envProgressionDetailSchema>;

function extractEnvironmentDetails(
  details: Record<string, unknown>,
): Map<string, PerEnvironmentDetail> {
  const envDetails = new Map<string, PerEnvironmentDetail>();

  for (const [key, value] of Object.entries(details)) {
    if (key.startsWith("environment_") && typeof value === "object") {
      const envId = key.replace("environment_", "");
      const parsed = perEnvironmentDetailSchema.safeParse(value);
      if (parsed.success) {
        envDetails.set(envId, parsed.data);
      }
    }
  }

  return envDetails;
}

type RuleEvaluation = WorkspaceEngine["schemas"]["RuleEvaluation"];

function SuccessRateStatus({ detail }: { detail: PerEnvironmentDetail }) {
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

function SoakTimeStatus({ detail }: { detail: PerEnvironmentDetail }) {
  if (detail.soak_minutes == null) return null;

  let remainingMinutes: number | null = null;
  if (detail.most_recent_success != null) {
    const successTime = new Date(detail.most_recent_success);
    const elapsedMs = Date.now() - successTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);
    remainingMinutes = Math.ceil(detail.soak_minutes - elapsedMinutes);
  }

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

function EnvironmentResult({ detail }: { detail: PerEnvironmentDetail }) {
  const hasDetails =
    detail.success_percentage != null || detail.soak_minutes != null;

  const minRequired = detail.minimum_success_percentage ?? 100;
  const passRatePassed =
    detail.success_percentage != null &&
    detail.success_percentage >= minRequired;

  let soakTimePassed = true;
  if (detail.soak_minutes != null && detail.most_recent_success != null) {
    const successTime = new Date(detail.most_recent_success);
    const elapsedMinutes = (Date.now() - successTime.getTime()) / (1000 * 60);
    soakTimePassed = elapsedMinutes >= detail.soak_minutes;
  }

  const isSuccess = hasDetails && passRatePassed && soakTimePassed;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle2Icon className="size-4 text-green-500" />
        ) : (
          <CircleAlertIcon className="size-4 text-amber-500" />
        )}
        <span className="text-sm font-medium">{detail.environment.name}</span>
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

function ProgressSummary({
  successful,
  total,
}: {
  successful: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((successful / total) * 100) : 0;
  const allSuccessful = successful === total && total > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Dependency Environments</span>
        <span
          className={cn(
            "font-medium",
            allSuccessful ? "text-green-500" : "text-amber-500",
          )}
        >
          {successful} / {total} passed
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            allSuccessful ? "bg-green-500" : "bg-amber-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function EnvProgressionDetail({
  ruleResult,
}: {
  ruleResult: RuleEvaluation;
}) {
  const { details } = ruleResult;
  const parsed = envProgressionDetailSchema.safeParse(details);
  if (!parsed.success) return null;

  const envDetails = extractEnvironmentDetails(
    details as Record<string, unknown>,
  );
  const successfulCount = parsed.data.successful_environments ?? 0;
  const totalCount =
    parsed.data.dependency_environment_count ?? envDetails.size;

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer rounded-sm p-1 text-left text-xs hover:bg-accent">
        {ruleResult.message}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Environment Progression</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ProgressSummary successful={successfulCount} total={totalCount} />

          {envDetails.size > 0 && (
            <div className="max-h-80 space-y-2 overflow-auto">
              {Array.from(envDetails.entries()).map(([envId, detail]) => (
                <EnvironmentResult key={envId} detail={detail} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
