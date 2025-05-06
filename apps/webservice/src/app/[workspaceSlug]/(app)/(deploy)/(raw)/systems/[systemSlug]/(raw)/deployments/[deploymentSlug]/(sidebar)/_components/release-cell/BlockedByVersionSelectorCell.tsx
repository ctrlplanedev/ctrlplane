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
import {
  DropdownAction,
  ForceDeployVersionDialog,
} from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/DeploymentVersionDropdownMenu";
import { urls } from "~/app/urls";

export const getPoliciesBlockingByVersionSelector = (
  policyEvaluations: PolicyEvaluationResult,
) =>
  Object.entries(policyEvaluations.rules.versionSelector)
    .filter(([_, isPassing]) => !isPassing)
    .map(([policyId]) =>
      policyEvaluations.policies.find((p) => p.id === policyId),
    )
    .filter(isPresent);

export const BlockedByVersionSelectorCell: React.FC<{
  policies: { id: string; name: string }[];
  deploymentVersion: { id: string; tag: string };
  deployment: { id: string; name: string; slug: string };
  environment: { id: string; name: string };
  system: { slug: string };
}> = ({ policies, deploymentVersion, deployment, environment, system }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .release(deploymentVersion.id)
    .checks();
  return (
    <>
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="flex h-full w-full items-center justify-center p-1">
            <Link
              href={versionUrl}
              className="flex w-full items-center gap-2 rounded-md p-2"
            >
              <div className="rounded-full bg-neutral-400 p-1 dark:text-black">
                <IconFilterX className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <div className="max-w-36 truncate font-semibold">
                  {deploymentVersion.tag}
                </div>
                <div className="text-xs text-muted-foreground">
                  Blocked by version selector
                </div>
              </div>
            </Link>
          </div>
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
