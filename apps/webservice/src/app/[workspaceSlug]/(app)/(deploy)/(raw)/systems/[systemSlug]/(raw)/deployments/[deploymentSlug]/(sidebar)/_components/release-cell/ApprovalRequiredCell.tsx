"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconShield,
} from "@tabler/icons-react";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";

import type { PolicyEvaluationResult } from "./policy-evaluation";
import { ApprovalDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ApprovalDialog";
import { DropdownAction } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { urls } from "~/app/urls";
import { Cell } from "./Cell";
import { useDeploymentVersionEnvironmentContext } from "./DeploymentVersionEnvironmentContext";

export const getPoliciesWithApprovalRequired = (
  policyEvaluations: PolicyEvaluationResult,
) => {
  const policiesWithAnyApprovalRequired = Object.entries(
    policyEvaluations.rules.anyApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  const policiesWithRoleApprovalRequired = Object.entries(
    policyEvaluations.rules.roleApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  const policiesWithUserApprovalRequired = Object.entries(
    policyEvaluations.rules.userApprovals,
  )
    .filter(([_, reasons]) => reasons.length > 0)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

  return _.uniqBy(
    [
      ...policiesWithAnyApprovalRequired,
      ...policiesWithRoleApprovalRequired,
      ...policiesWithUserApprovalRequired,
    ],
    (p) => p.id,
  );
};

const YellowShieldIcon: React.FC = () => (
  <div className="rounded-full bg-yellow-400 p-1 dark:text-black">
    <IconShield className="h-4 w-4" strokeWidth={2} />
  </div>
);

export const ApprovalRequiredCell: React.FC<{
  policies: { id: string; name: string }[];
}> = ({ policies }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const { deploymentVersion, deployment, environment, system } =
    useDeploymentVersionEnvironmentContext();

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Cell Icon={<YellowShieldIcon />} label="Approval required" />
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <IconShield className="h-3 w-3" strokeWidth={2} />
              Policies missing approval
            </div>
            {policies.map((p) => (
              <Link
                href={urls
                  .workspace(workspaceSlug)
                  .policies()
                  .edit(p.id)
                  .qualitySecurity()}
                key={p.id}
                className="max-w-72 truncate underline-offset-1 hover:underline"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
          >
            <IconDotsVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ApprovalDialog
            versionId={deploymentVersion.id}
            versionTag={deploymentVersion.tag}
            systemId={system.id}
            environmentId={environment.id}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="space-x-2"
            >
              <IconShield className="h-4 w-4" />
              <span>Review</span>
            </DropdownMenuItem>
          </ApprovalDialog>
          <DropdownAction
            deployment={deployment}
            environment={environment}
            icon={<IconAlertTriangle className="h-4 w-4" />}
            label="Force deploy"
            Dialog={ForceDeployVersionDialog}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
