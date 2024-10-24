import type { Deployment, Environment, Target } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconCircleFilled } from "@tabler/icons-react";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";

import { DeploymentOptionsDropdown } from "~/app/[workspaceSlug]/_components/DeploymentOptionsDropdown";
import { api } from "~/trpc/server";
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

const EnvIcon: React.FC<{
  isFirst?: boolean;
  isLast?: boolean;
  environment: Environment & { targets: Target[] };
  workspaceSlug: string;
  systemSlug: string;
}> = ({ environment: env, isFirst, isLast, workspaceSlug, systemSlug }) => {
  return (
    <Icon
      key={env.id}
      className={cn(
        "border-x border-t border-neutral-800/30 hover:bg-neutral-800/20",
        isFirst && "rounded-tl-md",
        isLast && "rounded-tr-md",
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
  );
};

const ReleaseCell: React.FC<{
  workspaceSlug: string;
  systemSlug: string;
  environment: Environment & { targets: Target[] };
  release: {
    id: string;
    name: string;
    version: string;
    createdAt: Date;
    environmentId: string;
  } | null;
  deployment: Deployment;
}> = async ({
  release,
  environment: env,
  deployment,
  workspaceSlug,
  systemSlug,
}) => {
  const releaseJobTriggers = await api.job.config.byDeploymentAndEnvironment({
    environmentId: env.id,
    deploymentId: deployment.id,
  });
  const hasTargets = env.targets.length > 0;
  const jc = releaseJobTriggers
    .filter(
      (releaseJobTrigger) =>
        isPresent(releaseJobTrigger.environmentId) &&
        isPresent(releaseJobTrigger.releaseId) &&
        isPresent(releaseJobTrigger.targetId),
    )
    .map((releaseJobTrigger) => ({ ...releaseJobTrigger }));
  return (
    <>
      {release && hasTargets && (
        <Release
          releaseId={release.id}
          environment={env}
          name={release.name}
          version={release.version}
          deployedAt={release.createdAt}
          releaseJobTriggers={jc}
          workspaceSlug={workspaceSlug}
          systemSlug={systemSlug}
          deploymentSlug={deployment.slug}
        />
      )}

      {!hasTargets && release && (
        <div className="text-center text-xs text-muted">No targets</div>
      )}

      {!release && (
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
      latestReleases: Array<{
        id: string;
        name: string;
        version: string;
        createdAt: Date;
        environmentId: string;
      }>;
    }
  >;
  workspaceSlug: string;
}> = ({ systemSlug, deployments, environments, workspaceSlug }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <Icon className="sticky left-0 z-10 backdrop-blur-lg" />
            {environments.map((env, idx) => (
              <EnvIcon
                key={env.id}
                environment={env}
                isFirst={idx === 0}
                isLast={idx === environments.length - 1}
                workspaceSlug={workspaceSlug}
                systemSlug={systemSlug}
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
                    <IconCircleFilled className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-green-300/20" />
                    <IconCircleFilled className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-green-300" />
                  </div>
                  <Link
                    href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${r.slug}/releases`}
                    className="flex-grow hover:text-blue-300"
                  >
                    {r.name}
                  </Link>
                  <DeploymentOptionsDropdown {...r} />
                </div>
              </td>

              {environments.map((env, envIdx) => {
                const latestRelease = r.latestReleases.find(
                  (release) => release.environmentId === env.id,
                );
                return (
                  <td
                    key={env.id}
                    className={cn(
                      "h-[55px] w-[220px] border-x border-b border-neutral-800 border-x-neutral-800/30 p-2 px-3",
                      envIdx === environments.length - 1 &&
                        "border-r-neutral-800",
                      idx === 0 && "border-t",
                    )}
                  >
                    <ReleaseCell
                      release={latestRelease ?? null}
                      environment={env}
                      deployment={r}
                      workspaceSlug={workspaceSlug}
                      systemSlug={systemSlug}
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
