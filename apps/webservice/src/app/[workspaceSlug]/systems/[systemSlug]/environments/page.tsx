import type { Metadata } from "next";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@ctrlplane/ui/resizable";

import { ReactFlowProvider } from "~/app/[workspaceSlug]/_components/reactflow/ReactFlowProvider";
import { api } from "~/trpc/server";
import { DeleteNodeDialogProvider } from "./DeleteNodeDialog";
import { EnvFlowBuilder } from "./EnvFlowBuilder";
import { Sidebar } from "./Sidebar";
import { PanelProvider } from "./SidepanelContext";

export const metadata: Metadata = { title: "Environments - Systems" };

export default async function SystemEnvironmentPage({
  params,
}: {
  params: { workspaceSlug: string; systemSlug: string };
}) {
  const sys = await api.system.bySlug(params);
  const envs = await api.environment.bySystemId(sys.id);
  const policies = await api.environment.policy.bySystemId(sys.id);
  const policyDeployments = await api.environment.policy.deployment.bySystemId(
    sys.id,
  );
  return (
    <PanelProvider>
      <DeleteNodeDialogProvider>
        <ReactFlowProvider>
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={60}>
              <div className="h-[calc(100vh-53px)]">
                <EnvFlowBuilder
                  workspaceId={sys.workspaceId}
                  systemId={sys.id}
                  envs={envs}
                  policies={policies}
                  policyDeployments={policyDeployments}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              className="min-w-[350px] max-w-[600px]"
              defaultSize={30}
            >
              <Sidebar systemId={sys.id} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ReactFlowProvider>
      </DeleteNodeDialogProvider>
    </PanelProvider>
  );
}
