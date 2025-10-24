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
import { EnvironmentActionsPanel } from "./_components/EnvironmentActionsPanel";
import { mockDeploymentDetail, mockEnvironments } from "./_components/mockData";
import { VersionActionsPanel } from "./_components/VersionActionsPanel";
import { VersionCard } from "./_components/VersionCard";

export function meta() {
  return [
    { title: "Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment details" },
  ];
}

export default function DeploymentDetail() {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");
  const selectedEnvironmentId = searchParams.get("env");

  const versionsQuery = trpc.deployment.versions.useQuery(
    {
      workspaceId: workspace.id,
      deploymentId: deployment.id,
      limit: 1000,
      offset: 0,
    },
    { refetchInterval: 5000 },
  );

  const releaseTargets = trpc.deployment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    deploymentId: deployment.id,
    limit: 1000,
    offset: 0,
  });

  // In a real app, fetch deployment data based on deploymentId
  const deploymentMock = mockDeploymentDetail;
  const environments = mockEnvironments;

  // Handle version selection
  const handleVersionSelect = useCallback(
    (versionId: string) => {
      if (selectedVersionId === versionId) {
        // Deselect if clicking same version
        setSearchParams({});
      } else {
        // Only show one panel at a time
        setSearchParams({ version: versionId });
      }
    },
    [selectedVersionId, setSearchParams],
  );

  // Handle environment selection
  const handleEnvironmentSelect = useCallback(
    (environmentId: string) => {
      if (selectedEnvironmentId === environmentId) {
        // Deselect if clicking same environment
        setSearchParams({});
      } else {
        // Only show one panel at a time
        setSearchParams({ env: environmentId });
      }
    },
    [selectedEnvironmentId, setSearchParams],
  );

  // Create ReactFlow nodes for environments (left to right flow)
  const computedNodes: Node[] = useMemo(() => {
    const version = deploymentMock.versions[0];

    // Group release targets by environment to get version info
    const releaseTargetsByEnv = deploymentMock.releaseTargets.reduce(
      (acc, rt) => {
        const envId = rt.environment.id;
        (acc[envId] ??= []).push(rt);
        return acc;
      },
      {} as Record<string, typeof deploymentMock.releaseTargets>,
    );

    const nodes: Node[] = [
      {
        id: "version-source",
        type: "version",
        position: { x: 50, y: 150 },
        data: version,
      },
      ...environments.map((environment) => {
        const envReleaseTargets = releaseTargetsByEnv[environment.id] ?? [];

        // Count resources per version (current)
        const currentVersionCounts = {};

        // Count resources per version (desired)
        const desiredVersionCounts = {};

        // Collect ALL blocked versions for all versions
        // const blockedVersionsByVersionId: Record<
        //   string,
        //   Array<{ reason: string }>
        // > = {};
        // envReleaseTargets.forEach((rt) => {
        //   rt.state.desiredRelease.blockedVersions.forEach((bv) => {
        //     if (!(bv.versionId in blockedVersionsByVersionId)) {
        //       blockedVersionsByVersionId[bv.version.id] = [];
        //     }
        //     blockedVersionsByVersionId[bv.version.id].push({
        //       reason: bv.reason,
        //     });
        //   });
        // });

        // Map version IDs to tags with counts
        const currentVersionsWithCounts = Object.entries(currentVersionCounts)
          .map(([id, count]) => ({
            tag: deploymentMock.versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        const desiredVersionsWithCounts = Object.entries(desiredVersionCounts)
          .map(([id, count]) => ({
            tag: deploymentMock.versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        return {
          id: environment.id,
          type: "environment",
          position: { x: 0, y: 0 },
          data: {
            id: environment.id,
            name: environment.name,
            resourceCount: envReleaseTargets.length,
            jobs: envReleaseTargets.flatMap((rt) => rt.jobs),
            currentVersionsWithCounts,
            desiredVersionsWithCounts,
            // blockedVersionsByVersionId,
            onSelect: () => handleEnvironmentSelect(environment.id),
          },
        };
      }),
    ];

    return nodes;
  }, [environments, deploymentMock, handleEnvironmentSelect]);

  // Create edges showing deployment progression (left to right)
  const computedEdges: Edge[] = useMemo(() => {
    const connections: Edge[] = [];
    const environmentsWithIncoming = new Set<string>();

    // Create edges based on environment dependencies
    for (const environment of environments) {
      for (const dependsOnEnvironmentId of environment.dependsOnEnvironmentIds) {
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
  }, [environments]);

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
                <BreadcrumbItem>
                  <Link to={`/${workspace.slug}/deployments`}>Deployments</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
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
          <DeploymentsNavbarTabs deploymentId={deployment.id} />
        </div>
      </header>

      {noVersions && (
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
      )}
      {!noVersions && (
        <>
          <div className="w-fit min-w-full max-w-full shrink-0 overflow-clip border-b bg-accent/50">
            {versions.length > 0 && (
              <div className="flex min-h-[175px] min-w-full flex-grow gap-2 overflow-x-auto p-4">
                {versions.map((version) => {
                  const currentReleaseTargets =
                    releaseTargets.data?.items.filter(
                      (rt) =>
                        rt.state.currentRelease?.version.id === version.id,
                    );
                  const desiredReleaseTargets =
                    releaseTargets.data?.items.filter(
                      (rt) =>
                        rt.state.desiredRelease?.version.id === version.id,
                    );
                  const isSelected = selectedVersionId === version.id;

                  return (
                    <VersionCard
                      key={version.id}
                      version={version}
                      currentReleaseTargets={currentReleaseTargets ?? []}
                      desiredReleaseTargets={desiredReleaseTargets ?? []}
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
              {selectedVersionId && (
                <VersionActionsPanel
                  version={
                    deploymentMock.versions.find(
                      (v) => v.id === selectedVersionId,
                    )!
                  }
                  environments={environments}
                  releaseTargets={deploymentMock.releaseTargets}
                  open={!!selectedVersionId}
                  onOpenChange={(open) => {
                    if (!open) setSearchParams({});
                  }}
                />
              )}

              {/* Environment Actions Dialog */}
              {selectedEnvironmentId && (
                <EnvironmentActionsPanel
                  environment={
                    environments.find((e) => e.id === selectedEnvironmentId)!
                  }
                  versions={deploymentMock.versions}
                  releaseTargets={deploymentMock.releaseTargets}
                  open={!!selectedEnvironmentId}
                  onOpenChange={(open) => {
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
