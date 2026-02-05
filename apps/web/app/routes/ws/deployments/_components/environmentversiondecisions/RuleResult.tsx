import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";
import { format, isValid, parseISO } from "date-fns";
import { AlertCircleIcon, Check, X } from "lucide-react";
import { rrulestr } from "rrule";

import { Button } from "~/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import {
  EnvProgressionDetail,
  envProgressionDetailSchema,
} from "./rule-results/EnvProgressionDetail";
import {
  GradualRolloutDetail,
  gradualRolloutDetailSchema,
} from "./rule-results/GradualRolloutDetail";

type RuleEvaluation = WorkspaceEngine["schemas"]["RuleEvaluation"];
type RruleDetails = {
  rrule: string;
  next_window_start?: string;
  next_deny_window_start?: string;
  window_end?: string;
  window_type?: string;
};

type WindowInfo = {
  label: string;
  date: Date;
};

function parseTimestamp(value: string | undefined): Date | null {
  if (value == null) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return parsed;
}

function formatDateTime(date: Date): string {
  return format(date, "MMM d, yyyy HH:mm");
}

function Message({ ruleResult }: { ruleResult: RuleEvaluation }) {
  const rruleDetails = ruleResult.details as Partial<RruleDetails>;
  return (
    <div>
      <div>{String(ruleResult.message)}</div>
      {typeof rruleDetails.rrule === "string" && (
        <Rrule {...rruleDetails} rrule={rruleDetails.rrule} />
      )}
    </div>
  );
}

function RuleDetail(props: { ruleResult: RuleEvaluation }) {
  const { details } = props.ruleResult;
  const gradualRolloutResult = gradualRolloutDetailSchema.safeParse(details);
  if (gradualRolloutResult.success) return <GradualRolloutDetail {...props} />;

  const envProgressionResult = envProgressionDetailSchema.safeParse(details);
  if (envProgressionResult.success)
    return <EnvProgressionDetail ruleResult={props.ruleResult} />;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Message {...props} />
      </HoverCardTrigger>
      <HoverCardContent className="max-h-96 w-96 overflow-auto">
        <pre className="text-xs">{JSON.stringify(details, null, 2)}</pre>
      </HoverCardContent>
    </HoverCard>
  );
}

function StatusIcon({ ruleResult }: { ruleResult: RuleEvaluation }) {
  if (ruleResult.allowed) return <Check className="size-3 text-green-500" />;
  if (ruleResult.actionRequired)
    return <AlertCircleIcon className="size-3 text-red-500" />;
  return <X className="size-3 text-red-500" />;
}

function ActionButton({
  ruleResult,
  onClickApprove,
  isPending,
}: {
  ruleResult: RuleEvaluation;
  onClickApprove: () => void;
  isPending: boolean;
}) {
  if (ruleResult.actionType !== "approval") return null;
  return (
    <Button
      className="h-5 bg-green-500/10 px-1.5 text-xs text-green-600 hover:bg-green-500/20 dark:text-green-400"
      onClick={onClickApprove}
      disabled={isPending}
    >
      Approve
    </Button>
  );
}

const Rrule: React.FC<RruleDetails> = ({
  rrule,
  next_window_start,
  next_deny_window_start,
  window_end,
  window_type,
}) => {
  let ruleText: string;
  try {
    const rule = rrulestr(rrule);
    ruleText = rule.toText();
  } catch {
    ruleText = rrule;
  }

  const windowEnd = parseTimestamp(window_end);
  const nextWindowStart = parseTimestamp(next_window_start);
  const nextDenyWindowStart = parseTimestamp(next_deny_window_start);
  let windowInfo: WindowInfo | null = null;

  if (windowEnd != null) {
    windowInfo = { label: "Window Ends", date: windowEnd };
  } else if (window_type === "deny" && nextDenyWindowStart != null) {
    windowInfo = { label: "Next Deny Window", date: nextDenyWindowStart };
  } else if (nextWindowStart != null) {
    windowInfo = { label: "Next Window", date: nextWindowStart };
  }

  return (
    <div>
      <div>
        <span>
          <strong>Schedule:</strong> {ruleText}
        </span>
        {windowInfo && (
          <>
            {", "}
            <strong>{windowInfo.label}:</strong> {formatDateTime(windowInfo.date)}
          </>
        )}
      </div>
    </div>
  );
};

export function RuleResult(props: {
  ruleResult: RuleEvaluation;
  onClickApprove: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <StatusIcon {...props} />
      <RuleDetail {...props} />
      <div className="grow" />
      <div className="text-xs text-muted-foreground">
        <ActionButton {...props} />
      </div>
    </div>
  );
}
