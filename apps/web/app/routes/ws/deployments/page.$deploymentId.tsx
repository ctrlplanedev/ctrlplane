import type { Edge, Node } from "reactflow";
import { useCallback, useMemo } from "react";
import _ from "lodash";
import { PackagePlus } from "lucide-react";
import { Link, useSearchParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateVersionDialog } from "./_components/CreateVersionDialog";
import { DeploymentFlow } from "./_components/DeploymentFlow";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentsNavbarTabs } from "./_components/DeploymentsNavbarTabs";
import { EnvironmentVersionDecisions } from "./_components/environmentversiondecisions/EnvironmentVersionDecisions";
import { VersionActionsPanel } from "./_components/VersionActionsPanel";
import { VersionCard } from "./_components/VersionCard";

export function meta() {
  return [
    { title: "Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment details" },
  ];
}

const NoVersions = () => {
  const { deployment } = useDeployment();
  return (
    <div className="flex h-full items-center justify-center">
      <div className="gap-4text-center flex flex-col items-center space-y-4 text-center">
        <div className="rounded-full bg-muted p-4">
          <PackagePlus className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">No versions yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first version to start deploying
          </p>
        </div>
        <CreateVersionDialog deploymentId={deployment.id}>
          <Button>
            <PackagePlus className="mr-2 h-4 w-4" />
            Create Version
          </Button>
        </CreateVersionDialog>
      </div>
    </div>
  );
};

export default function DeploymentDetail() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();

  const versionsQuery = trpc.deployment.versions.useQuery(
    {
      workspaceId: workspace.id,
      deploymentId: deployment.id,
      limit: 1000,
      offset: 0,
    },
    { refetchInterval: 5000 },
  );

  const releaseTargetsQuery = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  const releaseTargets = useMemo(
    () => releaseTargetsQuery.data?.items ?? [],
    [releaseTargetsQuery.data?.items],
  );

  // Fetch all environments from the system
  const environmentsQuery = trpc.environment.list.useQuery({
    workspaceId: workspace.id,
  });

  const policiesQuery = trpc.deployment.policies.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
  });

  const policies = useMemo(
    () => policiesQuery.data ?? [],
    [policiesQuery.data],
  );

  const environments = useMemo(
    () =>
      (environmentsQuery.data?.items ?? []).filter(
        (e) => e.systemId === deployment.systemId,
      ),
    [deployment.systemId, environmentsQuery.data?.items],
  );

  const envDependsOn = useCallback(
    (environmentId: string) =>
      policies
        .filter(({ policy }) => policy.enabled)
        .filter(({ releaseTargets }) =>
          releaseTargets.some((rt) => rt.environmentId === environmentId),
        )
        .flatMap(({ environmentIds }) => environmentIds),
    [policies],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");
  const selectedVersion = versionsQuery.data?.items.find(
    (v) => v.id === selectedVersionId,
  );
  const selectedEnvironmentId = searchParams.get("env");
  const selectedEnvironment = environments.find(
    (e) => e.id === selectedEnvironmentId,
  );

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      setSearchParams(
        selectedVersionId === versionId ? {} : { version: versionId },
      );
    },
    [selectedVersionId, setSearchParams],
  );

  const handleEnvironmentSelect = useCallback(
    (environmentId: string) => {
      setSearchParams(
        selectedEnvironmentId === environmentId ? {} : { env: environmentId },
      );
    },
    [selectedEnvironmentId, setSearchParams],
  );

  // Create ReactFlow nodes for environments (left to right flow)
  const computedNodes: Node[] = useMemo(() => {
    const versions = versionsQuery.data?.items ?? [];
    if (versions.length === 0) return [];

    const firstVersion = versions[0];

    // Group release targets by environment using lodash groupBy
    const releaseTargetsByEnv = _.groupBy(
      releaseTargets,
      (rt) => rt.releaseTarget.environmentId,
    );

    const nodes: Node[] = [
      {
        id: "version-source",
        type: "version",
        position: { x: 50, y: 150 },
        data: firstVersion,
      },
      ...environments.map((environment) => {
        const envReleaseTargets = releaseTargetsByEnv[environment.id] ?? [];

        // Count resources per version (current)
        const currentVersionCounts: Record<string, number> = {};
        envReleaseTargets.forEach((rt) => {
          const versionId = rt.state.currentRelease?.version.id;
          if (versionId) {
            currentVersionCounts[versionId] =
              (currentVersionCounts[versionId] ?? 0) + 1;
          }
        });

        // Count resources per version (desired)
        const desiredVersionCounts: Record<string, number> = {};
        envReleaseTargets.forEach((rt) => {
          const versionId = rt.state.desiredRelease?.version.id;
          if (versionId) {
            desiredVersionCounts[versionId] =
              (desiredVersionCounts[versionId] ?? 0) + 1;
          }
        });

        // Map version IDs to tags with counts
        const currentVersionsWithCounts = Object.entries(currentVersionCounts)
          .map(([id, count]) => ({
            name: versions.find((v) => v.id === id)?.name ?? id,
            tag: versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        const desiredVersionsWithCounts = Object.entries(desiredVersionCounts)
          .map(([id, count]) => ({
            name: versions.find((v) => v.id === id)?.name ?? id,
            tag: versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        // Collect jobs from latest job in each release target
        const jobs = envReleaseTargets
          .map((rt) => rt.state.latestJob?.job)
          .filter((job): job is NonNullable<typeof job> => job != null);

        return {
          id: environment.id,
          type: "environment",
          position: { x: 0, y: 0 },
          data: {
            id: environment.id,
            name: environment.name,
            resourceCount: envReleaseTargets.length,
            jobs,
            currentVersionsWithCounts,
            desiredVersionsWithCounts,
            isLoading: releaseTargetsQuery.isLoading,
            onSelect: () => handleEnvironmentSelect(environment.id),
          },
        };
      }),
    ];

    return nodes;
  }, [
    environments,
    releaseTargets,
    versionsQuery.data?.items,
    handleEnvironmentSelect,
    releaseTargetsQuery.isLoading,
  ]);

  // Create edges showing deployment progression (left to right)
  const computedEdges: Edge[] = useMemo(() => {
    const connections: Edge[] = [];
    const environmentsWithIncoming = new Set<string>();

    // Create edges based on environment dependencies (if the field exists)
    for (const environment of environments) {
      // Check if environment has dependency information
      const dependsOnIds = envDependsOn(environment.id);
      for (const dependsOnEnvironmentId of dependsOnIds) {
        connections.push({
          id: `${dependsOnEnvironmentId}-${environment.id}`,
          source: dependsOnEnvironmentId,
          target: environment.id,
          animated: true,
          style: { stroke: "#3b82f6", strokeWidth: 2 },
        });
        environmentsWithIncoming.add(environment.id);
      }
    }

    // Connect environments with no dependencies to the version node
    for (const environment of environments) {
      if (!environmentsWithIncoming.has(environment.id)) {
        connections.push({
          id: `version-source-${environment.id}`,
          source: "version-source",
          target: environment.id,
          animated: true,
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
        });
      }
    }

    return connections;
  }, [environments, envDependsOn]);

  const versions = versionsQuery.data?.items ?? [];
  const noVersions = !versionsQuery.isLoading && versions.length === 0;
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
                <BreadcrumbPage>{deployment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          {!noVersions && (
            <CreateVersionDialog deploymentId={deployment.id}>
              <Button variant="outline">
                <PackagePlus className="mr-2 h-4 w-4" />
                Create Version
              </Button>
            </CreateVersionDialog>
          )}
          <DeploymentsNavbarTabs />
        </div>
      </header>

      {noVersions && <NoVersions />}

      {!noVersions && (
        <>
          <div className="w-fit min-w-full max-w-full shrink-0 overflow-clip border-b bg-accent/50">
            {versions.length > 0 && (
              <div className="flex min-h-[175px] min-w-full grow gap-2 overflow-x-auto p-4">
                {versions.map((version) => {
                  const currentReleaseTargets = releaseTargets.filter(
                    (rt) => rt.state.currentRelease?.version.id === version.id,
                  );
                  const desiredReleaseTargets = releaseTargets.filter(
                    (rt) => rt.state.desiredRelease?.version.id === version.id,
                  );
                  const isSelected = selectedVersionId === version.id;

                  return (
                    <VersionCard
                      key={version.id}
                      version={version}
                      currentReleaseTargets={currentReleaseTargets}
                      desiredReleaseTargets={desiredReleaseTargets}
                      isSelected={isSelected}
                      onSelect={() => handleVersionSelect(version.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 overflow-clip">
            <ResizablePanelGroup direction="horizontal">
              {/* Main ReactFlow Panel */}
              <ResizablePanel
                defaultSize={
                  selectedVersionId || selectedEnvironmentId ? 70 : 100
                }
                minSize={50}
              >
                <DeploymentFlow
                  computedNodes={computedNodes}
                  computedEdges={computedEdges}
                />
              </ResizablePanel>

              {/* Version Actions Dialog */}
              {selectedVersionId && selectedVersion && (
                <VersionActionsPanel
                  version={selectedVersion}
                  environments={environments as any}
                  open={!!selectedVersionId}
                  onOpenChange={(open) => {
                    if (!open) setSearchParams({});
                  }}
                />
              )}

              {selectedEnvironment != null && (
                <EnvironmentVersionDecisions
                  environment={selectedEnvironment}
                  deploymentId={deployment.id}
                  versions={versions}
                  open={selectedEnvironmentId !== null}
                  onOpenChange={(open: boolean) => {
                    if (!open) setSearchParams({});
                  }}
                />
              )}
            </ResizablePanelGroup>
          </div>
        </>
      )}
    </>
  );
}
