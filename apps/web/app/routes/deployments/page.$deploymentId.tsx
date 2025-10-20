import type { Edge, Node } from "reactflow";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import "reactflow/dist/style.css";

import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { edgeTypes, nodeTypes } from "./_components/flow";
import { layoutNodes } from "./_components/flow/layout";
import { mockDeploymentDetail, mockEnvironments } from "./_components/mockData";
import { VersionCard } from "./_components/VersionCard";

export function meta() {
  return [
    { title: "Deployment Details - Ctrlplane" },
    { name: "description", content: "View deployment details" },
  ];
}

export default function DeploymentDetail() {
  const [searchParams] = useSearchParams();
  const _versionId = searchParams.get("version");

  const _deploymentId = useParams().deploymentId;
  const [selectedTab, setSelectedTab] = useState("environments");

  // In a real app, fetch deployment data based on deploymentId
  const deployment = mockDeploymentDetail;
  const environments = mockEnvironments;

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

        // Check if any release targets have blocked versions
        const hasPolicyBlocks = envReleaseTargets.some(
          (rt) =>
            rt.version.blockedVersions && rt.version.blockedVersions.length > 0,
        );

        // Collect all blocked versions across all release targets
        const blockedVersionsMap = new Map<string, Set<string>>();
        envReleaseTargets.forEach((rt) => {
          rt.version.blockedVersions?.forEach((bv) => {
            if (!blockedVersionsMap.has(bv.versionId)) {
              blockedVersionsMap.set(bv.versionId, new Set());
            }
            blockedVersionsMap.get(bv.versionId)?.add(bv.reason);
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
            hasPolicyBlocks,
            blockedVersionsMap: Array.from(blockedVersionsMap.entries()).map(
              ([versionId, reasons]) => ({
                versionTag:
                  deployment.versions.find((v) => v.id === versionId)?.tag ??
                  versionId,
                reasons: Array.from(reasons),
              }),
            ),
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

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  const onLayout = useCallback(
    (cb?: () => void) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = layoutNodes(
        nodes,
        edges,
      );

      setNodes(layoutedNodes as Node[]);
      setEdges(layoutedEdges);

      // Call callback after state updates (next frame)
      if (cb) {
        requestAnimationFrame(() => {
          requestAnimationFrame(cb);
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, edges],
  );

  return (
    <div className="flex flex-1 flex-col">
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
            return (
              <VersionCard
                key={version.id}
                version={version}
                currentReleaseTargets={currentReleaseTargets}
                desiredReleaseTargets={desiredReleaseTargets}
              />
            );
          })}
        </div>
      </div>

      {/* Environment Flow Visualization */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="h-full w-full rounded-lg">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              onInit={(reactFlowInstance) => {
                onLayout(() => {
                  reactFlowInstance.fitView();
                });
              }}
              minZoom={0.5}
              maxZoom={1.5}
              defaultEdgeOptions={{
                type: "smoothstep",
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
