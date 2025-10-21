"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import _ from "lodash";

import { authClient } from "@ctrlplane/auth";
import * as schema from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";

import type { ApprovalState } from "./types";
import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { api } from "~/trpc/react";

const isAnyApprovalRequired = (
  approvalState: ApprovalState,
  userId: string,
) => {
  const recordFromUser = approvalState.anyApprovalRecords.find(
    (r) => r.userId === userId && r.status === schema.ApprovalStatus.Approved,
  );
  if (recordFromUser != null) return false;

  const anyApprovalsRequired =
    _.max(
      approvalState.policies.map(
        (p) => p.versionAnyApprovals?.requiredApprovalsCount ?? 0,
      ),
    ) ?? 0;
  const numberOfApproved = approvalState.anyApprovalRecords.filter(
    (r) => r.status === schema.ApprovalStatus.Approved,
  ).length;

  return numberOfApproved < anyApprovalsRequired;
};

const isUserSpecificApprovalRequired = (
  approvalState: ApprovalState,
  userId: string,
) => {
  const ruleForUser = approvalState.policies
    .flatMap((p) => p.versionUserApprovals)
    .find((r) => r.userId === userId);
  if (ruleForUser == null) return false;

  const approvalFromUser = approvalState.userApprovalRecords.find(
    (r) => r.userId === userId && r.status === schema.ApprovalStatus.Approved,
  );
  return approvalFromUser == null;
};

const isUserReviewRequired = (approvalState: ApprovalState, userId: string) => {
  if (isAnyApprovalRequired(approvalState, userId)) return true;
  if (isUserSpecificApprovalRequired(approvalState, userId)) return true;
  return false;
};

export const ReviewRequestedAlert: React.FC<{
  approvalState: ApprovalState;
}> = ({ approvalState }) => {
  const { environment, version } = approvalState;
  const { data: session } = authClient.useSession();
  const utils = api.useUtils();
  if (session == null) return null;

  const { user } = session;
  const isReviewRequired = isUserReviewRequired(approvalState, user.id);
  if (!isReviewRequired) return null;

  const invalidate = () =>
    utils.policy.approval.byEnvironmentVersion.invalidate({
      environmentId: environment.id,
      versionId: version.id,
    });

  return (
    <div className="flex items-center justify-between rounded-md bg-purple-400/20 p-2 ">
      <div className="flex items-center gap-2 text-purple-400">
        <IconAlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">Your review is requested</span>
      </div>
      <div className="flex-shrink-0">
        <ApprovalDialog
          versionId={version.id}
          versionTag={version.tag}
          systemId={environment.systemId}
          environmentId={environment.id}
          onSubmit={invalidate}
        >
          <Button
            size="sm"
            variant="ghost"
            className="text-purple-400 hover:bg-purple-400/30 hover:text-purple-400"
          >
            Review
          </Button>
        </ApprovalDialog>
      </div>
    </div>
  );
};
