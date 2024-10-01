"use client";

import type { Deployment } from "@ctrlplane/db/schema";
import type { ReleaseType } from "semver";
import Link from "next/link";
import { useParams } from "next/navigation";
import _ from "lodash";
import { parse, valid } from "semver";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { api } from "~/trpc/react";
import { DeployButton } from "./DeployButton";
import { Release } from "./TableCells";

const Icon: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <th
    className={cn(
      "sticky left-0 p-2 px-3 text-left text-sm font-normal text-muted-foreground",
      className,
    )}
  >
    {children}
  </th>
);

const SemverHelperButtons: React.FC<{
  deploymentId: string;
  systemId: string;
  version: string;
}> = ({ deploymentId, systemId, version }) => {
  const inc = (releaseType: ReleaseType) => {
    const sv = parse(version)!;
    const hasV = version.startsWith("v");
    const versionStr = sv.inc(releaseType).version;
    return hasV ? `v${versionStr}` : versionStr;
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      <CreateReleaseDialog
        deploymentId={deploymentId}
        systemId={systemId}
        version={inc("major")}
      >
        <Button size="sm" variant="outline">
          + Major
        </Button>
      </CreateReleaseDialog>
      <CreateReleaseDialog
        deploymentId={deploymentId}
        systemId={systemId}
        version={inc("minor")}
      >
        <Button size="sm" variant="outline">
          + Minor
        </Button>
      </CreateReleaseDialog>
      <CreateReleaseDialog
        deploymentId={deploymentId}
        systemId={systemId}
        version={inc("patch")}
      >
        <Button size="sm" variant="outline">
          + Patch
        </Button>
      </CreateReleaseDialog>
    </div>
  );
};

export const ReleaseTable: React.FC<{
  deployment: Deployment;
  environments: {
    id: string;
    name: string;
    targets: { id: string }[];
  }[];
}> = ({ deployment, environments }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();
  const releaseJobTriggersQuery = api.job.config.byDeploymentId.useQuery(
    deployment.id,
    { refetchInterval: 2_000 },
  );

  const releases = api.release.list.useQuery(
    { deploymentId: deployment.id },
    { refetchInterval: 10_000 },
  );

  const releaseJobTriggers = (releaseJobTriggersQuery.data ?? [])
    .filter(
      (releaseJobTrigger) =>
        isPresent(releaseJobTrigger.environmentId) &&
        isPresent(releaseJobTrigger.releaseId) &&
        isPresent(releaseJobTrigger.targetId),
    )
    .map((releaseJobTrigger) => ({
      ...releaseJobTrigger,
      environmentId: releaseJobTrigger.environmentId,
      target: releaseJobTrigger.target!,
      releaseId: releaseJobTrigger.releaseId,
    }));

  const firstRelease = releases.data?.at(0);
  const distribution = api.deployment.distributionById.useQuery(deployment.id, {
    refetchInterval: 2_000,
  });
  console.log("distribution.data**********************", distribution);
  const releaseIds = releases.data?.map((r) => r.id) ?? [];
  const blockedEnvByRelease = api.release.blockedEnvironments.useQuery(
    releaseIds,
    { enabled: releaseIds.length > 0 },
  );

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Icon className="sticky left-0 z-10 pl-0 pt-0 backdrop-blur-lg">
              {firstRelease != null && valid(firstRelease.version) && (
                <SemverHelperButtons
                  deploymentId={deployment.id}
                  systemId={deployment.systemId}
                  version={firstRelease.version}
                />
              )}
            </Icon>
            {environments.map((env, idx) => (
              <Icon
                key={env.id}
                className={cn(
                  "border-x border-t border-neutral-800/30 hover:bg-neutral-800/20",
                  idx === 0 && "rounded-tl-md",
                  idx === environments.length - 1 && "rounded-tr-md",
                )}
              >
                <Link
                  href={`/${workspaceSlug}/systems/${systemSlug}/environments?selected=${env.id}`}
                >
                  <div className="flex justify-between">
                    {env.name}

                    <Badge
                      variant="outline"
                      className="rounded-full text-muted-foreground"
                    >
                      {env.targets.length}
                    </Badge>
                  </div>
                </Link>
              </Icon>
            ))}
          </tr>
        </thead>
        <tbody className="roudned-2xl">
          {releases.data?.map((r, releaseIdx) => {
            const blockedEnvs = blockedEnvByRelease.data?.[r.id] ?? [];
            return (
              <tr key={r.id} className="bg-neutral-800/10">
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[250px] backdrop-blur-lg",
                    "items-center border-b border-l px-4 text-lg",
                    releaseIdx === 0 && "rounded-tl-md border-t",
                    releaseIdx === releases.data.length - 1 && "rounded-bl-md",
                  )}
                >
                  {r.version}
                </td>
                {environments.map((env, idx) => {
                  const environmentReleaseReleaseJobTriggers =
                    releaseJobTriggers.filter(
                      (t) => t.releaseId === r.id && t.environmentId === env.id,
                    );

                  const activeDeploymentCount =
                    distribution.data?.filter(
                      (d) =>
                        d.release.id === r.id &&
                        d.releaseJobTrigger.environmentId === env.id,
                    ).length ?? 0;
                  console.log(
                    "activeDeploymentCount**********************",
                    activeDeploymentCount,
                  );
                  const hasTargets = env.targets.length > 0;
                  const hasRelease =
                    environmentReleaseReleaseJobTriggers.length > 0;
                  const hasJobAgent = deployment.jobAgentId != null;
                  const isBlockedByPolicyEvaluation = blockedEnvs.includes(
                    env.id,
                  );

                  const showRelease = hasRelease;
                  const canDeploy =
                    !hasRelease &&
                    hasJobAgent &&
                    hasTargets &&
                    !isBlockedByPolicyEvaluation;

                  return (
                    <td
                      key={env.id}
                      className={cn(
                        "h-[55px] w-[220px] border-x border-b border-neutral-800 border-x-neutral-800/30 p-2 px-3",
                        releaseIdx === 0 && "border-t",
                        idx === environments.length - 1 &&
                          "border-r-neutral-800",
                        activeDeploymentCount > 0 && "bg-neutral-400/5",
                      )}
                    >
                      {showRelease && (
                        <Release
                          workspaceSlug={workspaceSlug}
                          systemSlug={systemSlug}
                          deploymentSlug={deployment.slug}
                          releaseId={r.id}
                          environment={env}
                          activeDeploymentCount={activeDeploymentCount}
                          name={r.version}
                          deployedAt={
                            environmentReleaseReleaseJobTriggers[0]!.createdAt
                          }
                          releaseJobTriggers={
                            environmentReleaseReleaseJobTriggers
                          }
                        />
                      )}

                      {canDeploy && (
                        <DeployButton releaseId={r.id} environmentId={env.id} />
                      )}

                      {!canDeploy && !hasRelease && (
                        <div className="text-center text-xs text-muted">
                          {isBlockedByPolicyEvaluation
                            ? "Blocked by policy"
                            : hasJobAgent
                              ? "No targets"
                              : "No job agent"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
