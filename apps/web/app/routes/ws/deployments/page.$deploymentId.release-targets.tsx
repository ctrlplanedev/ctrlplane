import type { FC } from "react";
import { useState } from "react";
import { Fragment } from "react/jsx-runtime";
import _ from "lodash";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { RedeployDialog } from "./_components/RedeployDialog";

const JobStatusDisplayName: Record<string, string> = {
  unknown: "Unknown",
  cancelled: "Cancelled",
  skipped: "Skipped",
  inProgress: "In Progress",
  actionRequired: "Action Required",
  pending: "Pending",
  failure: "Failure",
  invalidJobAgent: "Invalid Job Agent",
  invalidIntegration: "Invalid Integration",
  externalRunNotFound: "External Run Not Found",
  successful: "Successful",
};

type ReleaseTarget = {
  releaseTarget: {
    deploymentId: string;
    environmentId: string;
    resourceId: string;
  };
  resource?: { id: string; version: string; kind: string; identifier: string };
  environment?: {
    id: string;
    name: string;
    resourceSelector?: { json?: Record<string, unknown>; cel?: string };
  };
  state: {
    latestJob?: {
      status?: string;
    };
    currentRelease?: {
      version: {
        tag: string;
      };
    };
    desiredRelease?: {
      version: {
        tag: string;
      };
    };
  };
};

type Environment = {
  id: string;
  name: string;
  resourceSelector?:
    | {
        json: Record<string, unknown>;
      }
    | {
        cel: string;
      };
};

type EnvironmentReleaseTargetsGroupProps = {
  releaseTargets: ReleaseTarget[];
  environment: Environment;
};

const EnvironmentReleaseTargetsGroup: FC<
  EnvironmentReleaseTargetsGroupProps
> = ({ releaseTargets, environment }) => {
  const [open, setOpen] = useState(true);

  let cel: string | undefined = undefined;
  let jsonSelector: string | undefined = undefined;

  if (environment.resourceSelector) {
    if ("cel" in environment.resourceSelector) {
      cel = environment.resourceSelector.cel;
    }
    if ("json" in environment.resourceSelector) {
      jsonSelector = JSON.stringify(environment.resourceSelector.json, null, 2);
    }
  }

  const rts = open ? releaseTargets : [];

  return (
    <Fragment key={environment.id}>
      <TableRow key={environment.id}>
        <TableCell colSpan={4} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5"
            >
              <ChevronRight
                className={cn("s-4 transition-transform", open && "rotate-90")}
              />
            </Button>
            <div className="grow">{environment.name} </div>
            <pre className="text-xs text-muted-foreground">
              {cel ?? jsonSelector}
            </pre>
          </div>
        </TableCell>
      </TableRow>
      {rts.map(({ releaseTarget, state }) => {
        const fromVersionRaw = state.currentRelease?.version.tag;
        const toVersion = state.desiredRelease?.version.tag ?? "unknown";
        const isInSync = !!fromVersionRaw && fromVersionRaw === toVersion;

        let versionDisplay;
        if (!fromVersionRaw) {
          versionDisplay = (
            <span className="italic text-neutral-500">
              Not yet deployed → {toVersion}
            </span>
          );
        } else if (isInSync) {
          versionDisplay = toVersion;
        } else {
          versionDisplay = `${fromVersionRaw} → ${toVersion}`;
        }

        return (
          <TableRow key={releaseTarget.resourceId}>
            <TableCell>{releaseTarget.resourceId}</TableCell>
            <TableCell>
              {JobStatusDisplayName[state.latestJob?.status ?? "unknown"]}
            </TableCell>
            <TableCell
              className={cn(
                isInSync ? "text-green-500" : "text-blue-500",
                "text-right font-mono text-sm",
              )}
            >
              {versionDisplay}
            </TableCell>
            <TableCell className="text-right">
              <RedeployDialog releaseTarget={releaseTarget} />
            </TableCell>
          </TableRow>
        );
      })}
    </Fragment>
  );
};

export default function ReleaseTargetsPage() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const environmentsQuery = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  const groupByEnvironmentId = _.groupBy(
    releaseTargets,
    (rt) => rt.releaseTarget.environmentId,
  );
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/deployments/${deployment.id}`}>
                    {deployment.name}
                  </Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>Targets</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <DeploymentsNavbarTabs />
      </header>
      <div>
        <Table className="border-b">
          <TableBody>
            {environmentsQuery.data?.items.map((environment) => {
              const releaseTargets = groupByEnvironmentId[environment.id] ?? [];
              return (
                <EnvironmentReleaseTargetsGroup
                  key={environment.id}
                  releaseTargets={releaseTargets}
                  environment={environment}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
