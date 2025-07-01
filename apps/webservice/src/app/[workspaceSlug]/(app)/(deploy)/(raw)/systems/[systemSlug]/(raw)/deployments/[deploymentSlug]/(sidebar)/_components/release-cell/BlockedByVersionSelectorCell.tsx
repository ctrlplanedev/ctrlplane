"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconFilterX,
} from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@ctrlplane/ui/hover-card";

import type { PolicyEvaluationResult } from "./policy-evaluation";
import { DropdownAction } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { urls } from "~/app/urls";
import { Cell } from "./Cell";
import { useDeploymentVersionEnvironmentContext } from "./DeploymentVersionEnvironmentContext";

export const getPoliciesBlockingByVersionSelector = (
  policyEvaluations: PolicyEvaluationResult,
) =>
  Object.entries(policyEvaluations.rules.versionSelector)
    .filter(([_, isPassing]) => !isPassing)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

const GreyFilterIcon: React.FC = () => (
  <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
    <IconFilterX className="h-4 w-4" strokeWidth={2} />
  </div>
);

export const BlockedByVersionSelectorCell: React.FC<{
  policies: { id: string; name: string }[];
}> = ({ policies }) => {
  const { deployment, environment } = useDeploymentVersionEnvironmentContext();

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <Cell Icon={<GreyFilterIcon />} label="Blocked by policy" />
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <IconFilterX className="h-3 w-3" strokeWidth={2} />
              Policies blocking version
            </div>
            {policies.map((p) => (
              <Link
                href={urls
                  .workspace(workspaceSlug)
                  .policies()
                  .edit(p.id)
                  .deploymentFlow()}
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
