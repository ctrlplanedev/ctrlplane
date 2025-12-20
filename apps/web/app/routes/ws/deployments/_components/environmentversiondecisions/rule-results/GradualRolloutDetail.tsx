import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { formatDistanceToNowStrict } from "date-fns";
import { CircleCheckIcon, Clock } from "lucide-react";
import { Link } from "react-router";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { useWorkspace } from "../../../../../../components/WorkspaceProvider";

const messageSchema = z.object({
  actionRequired: z.boolean(),
  actionType: z.enum(["approval", "wait"]).optional(),
  allowed: z.boolean(),
  details: z.object({
    resource: z.object({
      id: z.string(),
      name: z.string(),
      identifier: z.string(),
    }),
    rollout_start_time: z.string().datetime(),
    target_rollout_position: z.number(),
    target_rollout_time: z.string().datetime(),
  }),
  message: z.string(),
  ruleId: z.string(),
});

export const gradualRolloutDetailSchema = z.object({
  denied_targets: z.number(),
  deployed_targets: z.number(),
  estimated_completion_time: z.string().datetime().nullable().optional(),
  next_deployment_time: z.string().datetime().nullable().optional(),
  pending_targets: z.number(),
  rollout_start_time: z.string().datetime().nullable().optional(),
  total_targets: z.number(),
  messages: z.array(messageSchema),
});

type RuleEvaluation = WorkspaceEngine["schemas"]["RuleEvaluation"];

function ProgressBar({
  deployedTargets,
  totalTargets,
}: {
  deployedTargets: number;
  totalTargets: number;
}) {
  if (totalTargets === 0) return null;
  const progress = deployedTargets / totalTargets;
  const percent = Math.round(progress * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-foreground">{percent}% rolled out</span>
    </div>
  );
}

function ResourceLink({
  name,
  identifier,
}: {
  name: string;
  identifier: string;
}) {
  const { workspace } = useWorkspace();
  return (
    <Link
      to={`/${workspace.slug}/resources/${encodeURIComponent(identifier)}`}
      className="hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {name}
    </Link>
  );
}

function Target({ message }: { message: z.infer<typeof messageSchema> }) {
  const { details } = message;
  const hasBeenRolledOut = new Date(details.target_rollout_time) < new Date();
  const { resource } = details;

  return (
    <div className="text-x flex items-center gap-2 rounded-sm border p-2 text-xs">
      {hasBeenRolledOut && (
        <CircleCheckIcon className="size-4 text-green-500" />
      )}
      {!hasBeenRolledOut && <Clock className="size-4 text-muted-foreground" />}
      <ResourceLink {...resource} />
      <div className="grow" />
      <span
        className={cn(
          hasBeenRolledOut ? "text-green-500" : "text-muted-foreground",
        )}
      >
        {hasBeenRolledOut ? "" : "in "}
        {formatDistanceToNowStrict(new Date(details.target_rollout_time))}
        {hasBeenRolledOut ? " ago" : ""}
      </span>
    </div>
  );
}

function Targets({ messages }: { messages: z.infer<typeof messageSchema>[] }) {
  const sortedMessages = messages.sort((a, b) => {
    return (
      a.details.target_rollout_position - b.details.target_rollout_position
    );
  });

  return (
    <div className="max-h-80 space-y-2 overflow-auto">
      {sortedMessages.map((message) => (
        <Target key={message.details.resource.id} message={message} />
      ))}
    </div>
  );
}

export function GradualRolloutDetail({
  ruleResult,
}: {
  ruleResult: RuleEvaluation;
}) {
  const { details } = ruleResult;
  const parsedResult = gradualRolloutDetailSchema.safeParse(details);
  if (!parsedResult.success) return null;

  return (
    <Dialog>
      <DialogTrigger className="cursor-pointer rounded-sm p-1 text-left text-xs hover:bg-accent">
        {ruleResult.message}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gradual Rollout</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <ProgressBar
            deployedTargets={parsedResult.data.deployed_targets}
            totalTargets={parsedResult.data.total_targets}
          />
          <Targets messages={parsedResult.data.messages} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
