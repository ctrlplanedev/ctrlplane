import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Fragment, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { ResourceIcon } from "~/components/ui/resource-icon";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { cn } from "~/lib/utils";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";

type ResolvedPolicy = WorkspaceEngine["schemas"]["ResolvedPolicy"];
type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTarget"];
type ReleaseTargetWithState =
  WorkspaceEngine["schemas"]["ReleaseTargetWithState"];

const releaseTargetKey = (releaseTarget: ReleaseTarget) =>
  `${releaseTarget.resourceId}-${releaseTarget.environmentId}-${releaseTarget.deploymentId}`;

type PolicyResourceRowProps = {
  releaseTarget: ReleaseTargetWithState;
};

const PolicyResourceRow: React.FC<PolicyResourceRowProps> = ({
  releaseTarget,
}) => {
  const { workspace } = useWorkspace();
  const { resource, environment } = releaseTarget;
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <ResourceIcon kind={resource.kind} version={resource.version} />
          <Link
            to={`/${workspace.slug}/resources/${encodeURIComponent(resource.identifier)}`}
            className="hover:underline"
          >
            {resource.name}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        <Link
          to={`/${workspace.slug}/environments/${environment.id}`}
          className="text-muted-foreground hover:underline"
        >
          {environment.name}
        </Link>
      </TableCell>
    </TableRow>
  );
};

type PolicyReleaseTargetsGroupProps = {
  policy: ResolvedPolicy;
  releaseTargets: ReleaseTargetWithState[];
};

const PolicyReleaseTargetsGroup: React.FC<PolicyReleaseTargetsGroupProps> = ({
  policy,
  releaseTargets,
}) => {
  const [open, setOpen] = useState(true);
  const visibleTargets = open ? releaseTargets : [];
  return (
    <Fragment>
      <TableRow>
        <TableCell colSpan={2} className="bg-muted/50">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="size-5 shrink-0"
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  open && "rotate-90",
                )}
              />
            </Button>
            <div className="flex flex-1 items-center gap-3">
              <span className="text-sm font-medium">{policy.policy.name}</span>
              <Badge variant={policy.policy.enabled ? "default" : "secondary"}>
                {policy.policy.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {releaseTargets.length} resource
              {releaseTargets.length === 1 ? "" : "s"}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {open && releaseTargets.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-sm text-muted-foreground">
            No resources match this policy.
          </TableCell>
        </TableRow>
      )}
      {visibleTargets.map((releaseTarget) => (
        <PolicyResourceRow
          key={releaseTargetKey(releaseTarget.releaseTarget)}
          releaseTarget={releaseTarget}
        />
      ))}
    </Fragment>
  );
};

export function meta() {
  return [
    { title: "Policies - Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment policy assignments" },
  ];
}

const DeploymentPolicies: React.FC = () => {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const policiesQuery = trpc.deployment.policies.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
  });

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const policies = useMemo(() => {
    return [...(policiesQuery.data ?? [])].sort((a, b) =>
      a.policy.name.localeCompare(b.policy.name),
    );
  }, [policiesQuery.data]);

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];

  const releaseTargetsByKey = useMemo(() => {
    return new Map(
      releaseTargets.map((releaseTarget) => [
        releaseTargetKey(releaseTarget.releaseTarget),
        releaseTarget,
      ]),
    );
  }, [releaseTargets]);

  const resolvePolicyTargets = (policy: ResolvedPolicy) => {
    return policy.releaseTargets
      .map((releaseTarget) =>
        releaseTargetsByKey.get(releaseTargetKey(releaseTarget)),
      )
      .filter(
        (releaseTarget): releaseTarget is ReleaseTargetWithState =>
          releaseTarget != null,
      )
      .sort((a, b) => {
        const environmentComparison = a.environment.name.localeCompare(
          b.environment.name,
        );
        if (environmentComparison !== 0) return environmentComparison;
        return a.resource.name.localeCompare(b.resource.name);
      });
  };

  const isLoading = policiesQuery.isLoading || releaseTargetsQuery.isLoading;

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
                <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Link to={`/${workspace.slug}/deployments/${deployment.id}`}>
                  {deployment.name}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbPage>Policies</BreadcrumbPage>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <DeploymentsNavbarTabs />
      </header>

      <div className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center p-6 text-sm text-muted-foreground">
            Loading policies...
          </div>
        ) : policies.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
            <div className="text-lg font-medium">
              No policies apply to this deployment
            </div>
            <div className="text-sm text-muted-foreground">
              Assign policies to release targets to see them here.
            </div>
          </div>
        ) : (
          <Table className="border-b">
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Environment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <PolicyReleaseTargetsGroup
                  key={policy.policy.id}
                  policy={policy}
                  releaseTargets={resolvePolicyTargets(policy)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
};

export default DeploymentPolicies;
