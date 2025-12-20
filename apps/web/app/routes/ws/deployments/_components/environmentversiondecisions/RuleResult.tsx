import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";
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
function Message({ ruleResult }: { ruleResult: RuleEvaluation }) {
  return (
    <div>
      <div>{String(ruleResult.message)}</div>
      {typeof ruleResult.details.rrule === "string" && (
        <Rrule {...(ruleResult.details as any)} />
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

const Rrule: React.FC<{ rrule: string; next_window_start: string }> = ({
  rrule,
  next_window_start,
}) => {
  let ruleText: string;
  try {
    const rule = rrulestr(rrule);
    ruleText = rule.toText();
  } catch {
    ruleText = rrule;
  }

  const nextWindowStart = new Date(next_window_start);

  return (
    <div>
      <div>
        <span>
          <strong>Schedule:</strong> {ruleText}
        </span>
        , <strong>Next Window:</strong>{" "}
        {nextWindowStart.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
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
