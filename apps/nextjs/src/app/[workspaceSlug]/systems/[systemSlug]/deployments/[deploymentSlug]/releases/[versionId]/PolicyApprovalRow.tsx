"use client";

import type {
  Environment,
  EnvironmentPolicyApproval,
} from "@ctrlplane/db/schema";
import { useRouter } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";

import { api } from "~/trpc/react";

export const PolicyApprovalRow: React.FC<{
  approval: EnvironmentPolicyApproval;
  environments: Environment[];
}> = ({ approval, environments }) => {
  const reject = api.environment.policy.approval.reject.useMutation();
  const approve = api.environment.policy.approval.approve.useMutation();
  const router = useRouter();
  const utils = api.useUtils();
  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-400/50 bg-blue-500/10 p-2 text-sm">
      <div className="ml-2 flex-grow">
        Approve deploying to {environments.map((e) => e.name).join(", ")}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await reject.mutateAsync(approval);
            router.refresh();
            utils.environment.policy.invalidate();
            utils.job.config.invalidate();
          }}
        >
          Reject
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            await approve.mutateAsync(approval);
            router.refresh();
            utils.environment.policy.invalidate();
            utils.job.config.invalidate();
          }}
        >
          Approve
        </Button>
      </div>
    </div>
  );
};
