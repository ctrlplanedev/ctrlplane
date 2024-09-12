import type {
  EnvironmentPolicy,
  EnvironmentPolicyDeployment,
  Release,
} from "@ctrlplane/db/schema";
import type { NodeProps } from "reactflow";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { addMilliseconds, isBefore } from "date-fns";
import prettyMilliseconds from "pretty-ms";
import { TbCheck, TbLoader2, TbMinus, TbX } from "react-icons/tb";
import { useTimeoutFn } from "react-use";
import { Handle, Position } from "reactflow";
import { satisfies } from "semver";
import colors from "tailwindcss/colors";

import { cn } from "@ctrlplane/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";

import { api } from "~/trpc/react";

const ApprovalDialog: React.FC<{
  releaseId: string;
  policyId: string;
  children: React.ReactNode;
}> = ({ releaseId, policyId, children }) => {
  const approve = api.environment.policy.approval.approve.useMutation();
  const rejected = api.environment.policy.approval.reject.useMutation();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approval</AlertDialogTitle>
          <AlertDialogDescription>
            Approving this action will initiate the deployment of the release to
            all currently linked environments.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={async () => {
              await rejected.mutateAsync({ releaseId, policyId });
              router.refresh();
            }}
          >
            Reject
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await approve.mutateAsync({ releaseId, policyId });
              router.refresh();
            }}
          >
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const Cancelled: React.FC = () => (
  <div className="rounded-full bg-neutral-400 p-0.5 dark:text-black">
    <TbMinus strokeWidth={3} />
  </div>
);

const Blocked: React.FC = () => (
  <div className="rounded-full bg-red-400 p-0.5 dark:text-black">
    <TbX strokeWidth={3} />
  </div>
);

const Passing: React.FC = () => (
  <div className="rounded-full bg-green-400 p-0.5 dark:text-black">
    <TbCheck strokeWidth={3} />
  </div>
);

const Waiting: React.FC = () => (
  <div className="animate-spin rounded-full bg-blue-400 p-0.5 dark:text-black">
    <TbLoader2 strokeWidth={3} />
  </div>
);

type PolicyNodeProps = NodeProps<
  EnvironmentPolicy & {
    release: Release;
    policyDeployments: Array<EnvironmentPolicyDeployment>;
  }
>;

const evaluateVersionCheck = (
  evaluateWith: "regex" | "semver" | "none",
  evaluate: string,
  version: string,
) =>
  evaluateWith === "none"
    ? true
    : evaluateWith === "regex"
      ? new RegExp(evaluate).test(version)
      : satisfies(version, evaluate);

const EvaluateCheck: React.FC<{
  version: string;
  evaluateWith: "regex" | "semver" | "none";
  evaluate: string;
}> = ({ version, evaluateWith, evaluate }) => {
  if (evaluateWith === "none") return;

  const passes = evaluateVersionCheck(evaluateWith, evaluate, version);
  if (evaluateWith === "regex") {
    return (
      <div className="flex items-center gap-2">
        {passes ? <Passing /> : <Blocked />} Satified <pre>{evaluate}</pre>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {passes ? <Passing /> : <Blocked />} Matchs regex
    </div>
  );
};

const MinSucessCheck: React.FC<PolicyNodeProps["data"]> = ({
  successMinimum,
  successType,
  release,
  policyDeployments,
}) => {
  const allJobs = api.job.config.byReleaseId.useQuery(release.id, {
    refetchInterval: 10_000,
  });
  const envIds = policyDeployments.map((p) => p.environmentId);
  const jobs = allJobs.data?.filter((j) =>
    envIds.includes(j.environmentId ?? ""),
  );

  if (successType === "optional") return null;

  if (successType === "some") {
    const passing =
      jobs?.filter((job) => job.jobExecution?.status === "completed").length ??
      0;

    const isMinSatified = passing >= successMinimum;
    return (
      <div className="flex items-center gap-2">
        {isMinSatified ? <Passing /> : <Waiting />} &ge; {successMinimum}{" "}
        completed sucessfully
      </div>
    );
  }

  const areAllCompleted =
    jobs?.every((job) => job.jobExecution?.status === "completed") ?? true;

  return (
    <div className="flex items-center gap-2">
      {areAllCompleted ? (
        <>
          <Passing /> All jobs completed
        </>
      ) : (
        <>
          <Waiting /> Waiting for all jobs to complete
        </>
      )}
    </div>
  );
};

const GradualRolloutCheck: React.FC<PolicyNodeProps["data"]> = (data) => {
  const completeDate = addMilliseconds(data.release.createdAt, data.duration);
  const [now, setNow] = useState(new Date());
  useTimeoutFn(() => setNow(new Date()), 1000);
  const completesInMs = completeDate.getTime() - now.getTime();
  return (
    <div className="flex items-center gap-2">
      {isBefore(new Date(), completeDate) ? <Waiting /> : <Passing />}{" "}
      {completesInMs < 0 ? (
        "Rollouts completed"
      ) : (
        <>
          Rollout completes in{" "}
          {prettyMilliseconds(completesInMs, {
            compact: true,
            keepDecimalsOnWholeSeconds: false,
          })}
        </>
      )}
    </div>
  );
};

const ApprovalCheck: React.FC<PolicyNodeProps["data"]> = ({ id, release }) => {
  const approval =
    api.environment.policy.approval.statusByReleasePolicyId.useQuery({
      releaseId: release.id,
      policyId: id,
    });

  if (!approval.isLoading && approval.data == null) {
    return (
      <div className="flex items-center gap-2">
        <Cancelled /> Approval skipped
      </div>
    );
  }
  const status = approval.data?.status;
  return (
    <ApprovalDialog policyId={id} releaseId={release.id}>
      <button
        disabled={status === "approved" || status === "rejected"}
        className="flex w-full items-center gap-2 rounded-md hover:bg-neutral-800/50"
      >
        {status === "approved" ? (
          <>
            <Passing /> Approved
          </>
        ) : status === "rejected" ? (
          <>
            <Blocked /> Rejected
          </>
        ) : (
          <>
            <Waiting /> Pending approval
          </>
        )}
      </button>
    </ApprovalDialog>
  );
};

export const PolicyNode: React.FC<PolicyNodeProps> = ({ data }) => {
  const passesVersionStringCheck = evaluateVersionCheck(
    data.evaluateWith,
    data.evaluate,
    data.release.version,
  );

  const noStringCheck = data.evaluateWith === "none";
  const noMinSuccess = data.successType === "optional";
  const noRollout = data.duration === 0;
  const noApproval = data.approvalRequirement === "automatic";
  return (
    <>
      <div
        className={cn(
          "relative w-[250px] space-y-1 rounded-md border px-2 py-1.5 text-sm",
        )}
      >
        {passesVersionStringCheck ? (
          <>
            {!noStringCheck && (
              <EvaluateCheck
                evaluateWith={data.evaluateWith}
                evaluate={data.evaluate}
                version={data.release.version}
              />
            )}
            {!noMinSuccess && <MinSucessCheck {...data} />}
            {!noRollout && <GradualRolloutCheck {...data} />}
            {!noApproval && <ApprovalCheck {...data} />}

            {noStringCheck && noMinSuccess && noRollout && noApproval && (
              <div className="text-muted-foreground">No policy checks.</div>
            )}
          </>
        ) : (
          <div className="text-muted-foreground">
            Release does not match pattern
          </div>
        )}
      </div>

      <Handle
        type="target"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Left}
      />
      <Handle
        type="source"
        className="h-2 w-2 rounded-full border border-neutral-500"
        style={{ background: colors.neutral[800] }}
        position={Position.Right}
      />
    </>
  );
};
