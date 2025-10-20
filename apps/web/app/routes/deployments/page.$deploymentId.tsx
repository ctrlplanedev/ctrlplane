import type { Edge, Node } from "reactflow";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DeploymentFlow } from "./_components/DeploymentFlow";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get("version");

  const _deploymentId = useParams().deploymentId;
  const [selectedTab, setSelectedTab] = useState("environments");

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
        setSearchParams({ version: versionId });
      }
    },
    [selectedVersionId, setSearchParams],
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
            name: environment.name,
            resourceCount: envReleaseTargets.length,
            jobs: envReleaseTargets.flatMap((rt) => rt.jobs),
            currentVersionsWithCounts,
            desiredVersionsWithCounts,
            blockedVersionsByVersionId,
          },
        };
      }),
    ];

    return nodes;
  }, [environments, deployment]);

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
    <div className="">
      <header className="shrink-0 border-b">
        <div className="flex items-center justify-between gap-8 px-4 py-6">
          <div className="flex items-center gap-4">
            <div>
              <Link to="/deployments">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold">{deployment.name}</h1>
              <p className="text-sm text-muted-foreground">
                {deployment.description}
              </p>
            </div>
          </div>

          <div>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList>
                <TabsTrigger
                  value="environments"
                  className="text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  Environments
                </TabsTrigger>
                <TabsTrigger
                  value="versions"
                  className="text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  Versions
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="text-base text-muted-foreground data-[state=active]:text-foreground"
                >
                  Activity
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
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

      <div className="flex h-[calc(100vh-101px-207px-1rem)] min-h-0 flex-1">
        <ResizablePanelGroup direction="horizontal">
          {/* Main ReactFlow Panel */}
          <ResizablePanel
            defaultSize={selectedVersionId ? 70 : 100}
            minSize={50}
          >
            <DeploymentFlow
              computedNodes={computedNodes}
              computedEdges={computedEdges}
            />
          </ResizablePanel>

          {/* Version Actions Sidebar */}
          {selectedVersionId && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <VersionActionsPanel
                  version={
                    deployment.versions.find((v) => v.id === selectedVersionId)!
                  }
                  environments={environments}
                  releaseTargets={deployment.releaseTargets}
                  onClose={() => setSearchParams({})}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
