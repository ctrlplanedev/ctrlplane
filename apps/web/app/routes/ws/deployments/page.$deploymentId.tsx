import type { Edge, Node } from "reactflow";
import { useCallback, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DeploymentFlow } from "./_components/DeploymentFlow";
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
  const { workspaceSlug, deploymentId: _ } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");
  const selectedEnvironmentId = searchParams.get("env");

  // In a real app, fetch deployment data based on deploymentId
  const deployment = mockDeploymentDetail;
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
    const version = deployment.versions[0];

    // Group release targets by environment to get version info
    const releaseTargetsByEnv = deployment.releaseTargets.reduce(
      (acc, rt) => {
        const envId = rt.environment.id;
        (acc[envId] ??= []).push(rt);
        return acc;
      },
      {} as Record<string, typeof deployment.releaseTargets>,
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
        const currentVersionCounts = envReleaseTargets.reduce(
          (acc, rt) => {
            acc[rt.version.currentId] = (acc[rt.version.currentId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Count resources per version (desired)
        const desiredVersionCounts = envReleaseTargets.reduce(
          (acc, rt) => {
            acc[rt.version.desiredId] = (acc[rt.version.desiredId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        // Collect ALL blocked versions for all versions
        const blockedVersionsByVersionId: Record<
          string,
          Array<{ reason: string }>
        > = {};
        envReleaseTargets.forEach((rt) => {
          rt.version.blockedVersions?.forEach((bv) => {
            if (!(bv.versionId in blockedVersionsByVersionId)) {
              blockedVersionsByVersionId[bv.versionId] = [];
            }
            blockedVersionsByVersionId[bv.versionId].push({
              reason: bv.reason,
            });
          });
        });

        // Map version IDs to tags with counts
        const currentVersionsWithCounts = Object.entries(currentVersionCounts)
          .map(([id, count]) => ({
            tag: deployment.versions.find((v) => v.id === id)?.tag ?? id,
            count,
          }))
          .filter((v) => v.tag);

        const desiredVersionsWithCounts = Object.entries(desiredVersionCounts)
          .map(([id, count]) => ({
            tag: deployment.versions.find((v) => v.id === id)?.tag ?? id,
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
            blockedVersionsByVersionId,
            onSelect: () => handleEnvironmentSelect(environment.id),
          },
        };
      }),
    ];

    return nodes;
  }, [environments, deployment, handleEnvironmentSelect]);

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
                  <Link to={`/${workspaceSlug}/deployments`}>Deployments</Link>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbPage>{deployment.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex items-center gap-4">
          <Tabs value="environments">
            <TabsList>
              <TabsTrigger value="environments" asChild>
                <Link to={`/deployments/${deployment.id}`}>Environments</Link>
              </TabsTrigger>
              <TabsTrigger value="versions" asChild>
                <Link to={`/deployments/${deployment.id}/versions`}>
                  Versions
                </Link>
              </TabsTrigger>
              <TabsTrigger value="activity" asChild>
                <Link to={`/deployments/${deployment.id}/activity`}>
                  Activity
                </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <div className="w-fit max-w-full shrink-0 overflow-clip border-b bg-accent/50">
        <div className="flex gap-2 overflow-x-auto p-4">
          {deployment.versions.map((version) => {
            const currentReleaseTargets = deployment.releaseTargets.filter(
              (rt) => rt.version.currentId === version.id,
            );
            const desiredReleaseTargets = deployment.releaseTargets.filter(
              (rt) => rt.version.desiredId === version.id,
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
      </div>

      <div className="flex h-[calc(100vh-101px-207px-1rem)] min-h-0 flex-1 overflow-clip">
        <ResizablePanelGroup direction="horizontal">
          {/* Main ReactFlow Panel */}
          <ResizablePanel
            defaultSize={selectedVersionId || selectedEnvironmentId ? 70 : 100}
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
                deployment.versions.find((v) => v.id === selectedVersionId)!
              }
              environments={environments}
              releaseTargets={deployment.releaseTargets}
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
              versions={deployment.versions}
              releaseTargets={deployment.releaseTargets}
              open={!!selectedEnvironmentId}
              onOpenChange={(open) => {
                if (!open) setSearchParams({});
              }}
            />
          )}
        </ResizablePanelGroup>
      </div>
    </>
  );
}
