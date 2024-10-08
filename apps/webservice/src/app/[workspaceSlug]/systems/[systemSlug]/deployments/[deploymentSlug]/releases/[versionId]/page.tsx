import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconFilter } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";
import { ScrollArea } from "@ctrlplane/ui/scroll-area";

import { ReactFlowProvider } from "~/app/[workspaceSlug]/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { FlowDiagram } from "./FlowDiagram";
import { PolicyApprovalRow } from "./PolicyApprovalRow";
import { TargetReleaseTable } from "./TargetReleaseTable";

export const metadata: Metadata = {
  title: "Release",
};

export default async function ReleasePage({
  params,
}: {
  params: {
    release: { id: string; version: string };
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
    versionId: string;
  };
}) {
  const release = await api.release.byId(params.versionId);
  const deployment = await api.deployment.bySlug(params);
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  if (release == null || deployment == null) notFound();

  const system = await api.system.bySlug(params);
  const environments = await api.environment.bySystemId(system.id);
  const policies = await api.environment.policy.bySystemId(system.id);
  const policyDeployments = await api.environment.policy.deployment.bySystemId(
    system.id,
  );

  const pendingApprovals = await api.environment.policy.approval.byReleaseId({
    releaseId: release.id,
    status: "pending",
  });

  return (
    <div className="flex h-[calc(100vh-53px)] flex-col">
      <div className="shrink-0 border-b p-4 text-lg text-muted-foreground">
        Release{" "}
        <span className="font-semibold text-white">{release.version}</span>
      </div>

      <ScrollArea>
        <div className="h-[250px] shrink-0 border-b">
          <ReactFlowProvider>
            <FlowDiagram
              release={release}
              envs={environments}
              systemId={system.id}
              policies={policies}
              policyDeployments={policyDeployments}
            />
          </ReactFlowProvider>
        </div>

        {pendingApprovals.length > 0 && (
          <div className="shrink-0 space-y-4 border-b p-6">
            <div>Pending Approvals</div>
            <div className="space-y-2">
              {pendingApprovals.map((approval) => (
                <PolicyApprovalRow
                  key={approval.id}
                  approval={approval}
                  environments={environments.filter(
                    (env) => env.policyId === approval.policyId,
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="shrink-0 border-b p-1">
          <Button variant="ghost" size="sm" className="flex gap-1">
            <IconFilter className="h-4 w-4" /> Filter
          </Button>
        </div>

        <TargetReleaseTable
          release={release}
          deploymentName={deployment.name}
        />
      </ScrollArea>
    </div>
  );
}
