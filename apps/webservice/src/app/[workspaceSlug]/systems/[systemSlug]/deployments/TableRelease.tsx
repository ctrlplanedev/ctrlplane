"use client";

import type {
  Deployment,
  JobConfig,
  JobExecution,
  Target,
} from "@ctrlplane/db/schema";
import type { ReleaseType } from "semver";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import _ from "lodash";
import { parse, valid } from "semver";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";

import { CreateReleaseDialog } from "~/app/[workspaceSlug]/_components/CreateRelease";
import { api } from "~/trpc/react";
import { Release } from "./TableCells";

const Tb: React.FC<{ children?: React.ReactNode; className?: string }> = ({
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
  jobConfigs: Array<
    JobConfig & {
      jobExecution: JobExecution | null;
      target: Target;
    }
  >;
  releases: { id: string; version: string; createdAt: Date }[];
  environments: {
    id: string;
    name: string;
    targets: { id: string }[];
  }[];
}> = ({ deployment, jobConfigs, releases, environments }) => {
  const firstRelease = releases.at(0);
  const deploy = api.release.deploy.toEnvironment.useMutation();
  const router = useRouter();
  const distrubtion = api.deployment.distrubtionById.useQuery(deployment.id, {
    refetchInterval: 2_000,
  });
  const releaseIds = releases.map((r) => r.id);
  const blockedEnvByRelease = api.release.blockedEnvironments.useQuery(
    releaseIds,
    { enabled: releaseIds.length > 0 },
  );

  const params = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Tb className="sticky left-0 z-10 pl-0 pt-0 backdrop-blur-lg">
              {firstRelease != null && valid(firstRelease.version) && (
                <SemverHelperButtons
                  deploymentId={deployment.id}
                  systemId={deployment.systemId}
                  version={firstRelease.version}
                />
              )}
            </Tb>
            {environments.map((env, idx) => (
              <Tb
                key={env.id}
                className={cn(
                  "border-x border-t border-neutral-800/30 hover:bg-neutral-800/20",
                  idx === 0 && "rounded-tl-md",
                  idx === environments.length - 1 && "rounded-tr-md",
                )}
              >
                <Link
                  href={`/${params.workspaceSlug}/systems/${params.systemSlug}/environments?selected=${env.id}`}
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
              </Tb>
            ))}
          </tr>
        </thead>
        <tbody className="roudned-2xl">
          {releases.map((r, releaseIdx) => {
            const blockedEnvs = blockedEnvByRelease.data?.[r.id] ?? [];
            return (
              <tr key={r.id} className="bg-neutral-800/10">
                <td
                  className={cn(
                    "sticky left-0 z-10 min-w-[250px] backdrop-blur-lg",
                    "items-center border-b border-l px-4 text-lg",
                    releaseIdx === 0 && "rounded-tl-md border-t",
                    releaseIdx === releases.length - 1 && "rounded-bl-md",
                  )}
                >
                  <Link
                    href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/releases/${r.id}`}
                  >
                    {r.version}
                  </Link>
                </td>
                {environments.map((env, idx) => {
                  const environmentReleaseJobConfigs = jobConfigs.filter(
                    (t) => t.releaseId === r.id && t.environmentId === env.id,
                  );

                  const hasActiveDeployment =
                    distrubtion.data?.filter(
                      (d) =>
                        d.release.id === r.id &&
                        d.jobConfig.environmentId === env.id,
                    ).length ?? 0;
                  const hasTargets = env.targets.length > 0;
                  const hasRelease = environmentReleaseJobConfigs.length > 0;
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
                        "h-[55px] w-[200px] border-x border-b border-neutral-800 border-x-neutral-800/30 p-2 px-3",
                        releaseIdx === 0 && "border-t",
                        idx === environments.length - 1 &&
                          "border-r-neutral-800",
                        hasActiveDeployment > 0 && "bg-neutral-400/5",
                      )}
                    >
                      {showRelease && (
                        <Release
                          activeDeploymentCount={hasActiveDeployment}
                          name={r.version}
                          deployedAt={
                            environmentReleaseJobConfigs[0]!.createdAt
                          }
                          jobConfigs={environmentReleaseJobConfigs}
                        />
                      )}

                      {canDeploy && (
                        <Button
                          className={cn(
                            "w-full border-dashed border-neutral-800/50 bg-transparent text-center text-neutral-800 hover:border-blue-400 hover:bg-transparent hover:text-blue-400",
                          )}
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.preventDefault();

                            await deploy.mutateAsync({
                              environmentId: env.id,
                              releaseId: r.id,
                            });

                            router.refresh();
                          }}
                          disabled={deploy.isPending}
                        >
                          Deploy
                        </Button>
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
