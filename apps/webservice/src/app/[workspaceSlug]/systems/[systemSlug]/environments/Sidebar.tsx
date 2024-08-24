"use client";

import { useReactFlow } from "reactflow";

import { ScrollArea } from "@ctrlplane/ui/scroll-area";

import { NodeType } from "./FlowNodeTypes";
import { SidebarEnvironmentPanel } from "./SidebarEnvironmentPanel";
import { SidebarPhasePanel } from "./SidebarPolicyPanel";
import { SidebarTriggerPanel } from "./SidebarTriggerPanel";
import { usePanel } from "./SidepanelContext";

export const Sidebar: React.FC<{ systemId: string }> = ({ systemId }) => {
  const { getNode } = useReactFlow();
  const { selectedNodeId } = usePanel();
  const node = getNode(selectedNodeId ?? "") ?? null;
  return (
    <ScrollArea className="h-[calc(100vh-53px)]">
      {node == null && <div className="m-6">Select a node</div>}
      {node?.type === NodeType.Policy && (
        <SidebarPhasePanel policy={node.data} systemId={systemId} />
      )}
      {node?.type === NodeType.Trigger && <SidebarTriggerPanel />}
      {node?.type === NodeType.Environment && <SidebarEnvironmentPanel />}
    </ScrollArea>
  );
};
