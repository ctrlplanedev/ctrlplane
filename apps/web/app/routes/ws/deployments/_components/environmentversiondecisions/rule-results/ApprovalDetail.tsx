import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";

function ApproverAvatar({ userId }: { userId: string }) {
  const { workspace } = useWorkspace();
  const { data: members } = trpc.workspace.members.useQuery(
    { workspaceId: workspace.id },
    { staleTime: 60_000 },
  );
  const member = members?.find((m) => m.user.id === userId);
  if (member == null)
    return (
      <span className="font-mono text-xs text-muted-foreground">
        {userId.slice(0, 8)}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <Avatar className="size-4">
        <AvatarImage
          src={member.user.image ?? undefined}
          referrerPolicy="no-referrer"
        />
        <AvatarFallback className="text-[8px]">
          {member.user.name?.charAt(0) ?? "?"}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs">{member.user.name ?? member.user.email}</span>
    </span>
  );
}

export type ApprovalDetailProps = {
  approvers: string[];
  environment_id: string;
  version_id: string;
  min_approvals: number;
};
export const ApprovalDetail: React.FC<ApprovalDetailProps> = ({
  approvers,
  min_approvals,
  version_id,
  environment_id,
}) => {
  const { data: session } = trpc.user.session.useQuery();
  const isApprover = approvers.includes(session?.id ?? "");
  const approveMutation = trpc.deploymentVersions.approve.useMutation();
  const onClickApprove = () =>
    approveMutation
      .mutateAsync({
        deploymentVersionId: version_id,
        environmentId: environment_id,
        status: "approved",
      })
      .then(() => {
        toast.success("Approval record queued successfully");
      });
  const approvedCount = approvers.length;
  const isPassing = approvedCount >= min_approvals;
  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex grow items-center gap-2">
        {isPassing ? (
          <>
            <CheckCircle2Icon className="size-3 text-green-500" />
            <span>
              Approval Passed ({approvedCount}/{min_approvals})
            </span>
          </>
        ) : (
          <>
            <CircleAlertIcon className="size-3 text-amber-500" />
            <span>
              Approval Required ({approvedCount}/{min_approvals})
            </span>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-4">
        {approvers.map((id) => (
          <ApproverAvatar key={id} userId={id} />
        ))}
      </div>
      {!isPassing && (
        <Button
          disabled={isApprover}
          className="h-5 rounded-full bg-green-500/10 px-2 text-xs text-green-600 hover:bg-green-500/20"
          onClick={onClickApprove}
        >
          {isApprover ? "Approved" : "Approve"}
          {isApprover && <CheckCircle2Icon className="size-3 text-green-500" />}
        </Button>
      )}
    </div>
  );
};
