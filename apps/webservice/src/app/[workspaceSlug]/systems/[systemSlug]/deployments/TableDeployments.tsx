"use client";

import type { Deployment, Environment, Target } from "@ctrlplane/db/schema";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TbCircleFilled, TbRocket, TbTerminal2 } from "react-icons/tb";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/_components/DeploymentOptionsDropdown";
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

const EnvTb: React.FC<{
  isFirst?: boolean;
  isLast?: boolean;
  environment: Environment & { targets: Target[] };
}> = ({ environment: env, isFirst, isLast }) => {
  const params = useParams<{ workspaceSlug: string; systemSlug: string }>();
  return (
    <Tb
      key={env.id}
      className={cn(
        "border-x border-t border-neutral-800/30 hover:bg-neutral-800/20",
        isFirst && "rounded-tl-md",
        isLast && "rounded-tr-md",
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
  );
};

const ReleaseCell: React.FC<{
  environment: Environment & { targets: Target[] };
  release: { id: string; version: string; createdAt: Date } | null;
  deployment: Deployment;
}> = ({ release, environment: env, deployment }) => {
  const jobConfigs = api.job.config.byDeploymentAndEnvironment.useQuery({
    environmentId: env.id,
    deploymentId: deployment.id,
  });
  const hasTargets = env.targets.length > 0;
  const hasRelease = release != null;
  const jc = (jobConfigs.data ?? [])
    .filter(
      (jobConfig) =>
        isPresent(jobConfig.environmentId) &&
        isPresent(jobConfig.releaseId) &&
        isPresent(jobConfig.targetId),
    )
    .map((jobConfig) => ({
      ...jobConfig,
      environmentId: jobConfig.environmentId!,
      target: jobConfig.target!,
      releaseId: jobConfig.releaseId!,
      deployment: jobConfig.release.deployment!,
    }));
  return (
    <>
      {hasRelease && hasTargets && (
        <Release
          name={release.version}
          deployedAt={release.createdAt}
          jobConfigs={jc}
        />
      )}

      {!hasTargets && hasRelease && (
        <div className="text-center text-xs text-muted">No targets</div>
      )}

      {!hasRelease && (
        <div className="text-center text-xs text-muted">No release</div>
      )}
    </>
  );
};

const DeploymentTable: React.FC<{
  systemSlug: string;
  environments: Array<Environment & { targets: Target[] }>;
  deployments: Array<
    Deployment & {
      latestRelease: { id: string; version: string; createdAt: Date } | null;
    }
  >;
}> = ({ systemSlug, deployments, environments }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Tb className="sticky left-0 z-10 backdrop-blur-lg" />
            {environments.map((env, idx) => (
              <EnvTb
                key={env.id}
                environment={env}
                isFirst={idx === 0}
                isLast={idx === environments.length - 1}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {deployments.map((r, idx) => (
            <tr key={r.id} className="bg-neutral-800/10">
              <td
                className={cn(
                  "sticky left-0 z-10 min-w-[500px] backdrop-blur-lg",
                  "items-center border-b border-l px-4 text-lg",
                  idx === 0 && "rounded-tl-md border-t",
                  idx === deployments.length - 1 && "rounded-bl-md",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <div className="relative h-[25px] w-[25px]">
                    <TbCircleFilled className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-green-300/20" />
                    <TbCircleFilled className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-green-300" />
                  </div>
                  <Link
                    href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${r.slug}`}
                    className="flex-grow hover:text-blue-300"
                  >
                    {r.name}
                  </Link>
                  <Button size="icon" variant="ghost">
                    <TbTerminal2 />
                  </Button>
                  <Button size="icon" variant="ghost">
                    <TbRocket />
                  </Button>
                  <DeploymentOptionsDropdown
                    deploymentId={r.id}
                    deploymentName={r.name}
                    deploymentSlug={r.slug}
                    deploymentDescription={r.description}
                  />
                </div>
              </td>

              {environments.map((env, envIdx) => {
                return (
                  <td
                    key={env.id}
                    className={cn(
                      "h-[55px] w-[200px] border-x border-b border-neutral-800 border-x-neutral-800/30 p-2 px-3",
                      envIdx === environments.length - 1 &&
                        "border-r-neutral-800",
                      idx === 0 && "border-t",
                    )}
                  >
                    <ReleaseCell
                      release={r.latestRelease}
                      environment={env}
                      deployment={r}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DeploymentTable;
