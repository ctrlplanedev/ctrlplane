import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { createContext, useContext } from "react";

export type Workflow = WorkspaceEngine["schemas"]["Workflow"] & {
  workflowRuns: WorkspaceEngine["schemas"]["WorkflowRunWithJobs"][];
};

type WorkflowContextType = {
  workflow: Workflow;
};

const WorkflowContext = createContext<WorkflowContextType | undefined>(
  undefined,
);

export function WorkflowProvider({
  workflow,
  children,
}: {
  workflow: Workflow;
  children: React.ReactNode;
}) {
  return (
    <WorkflowContext.Provider value={{ workflow }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined)
    throw new Error("useWorkflow must be used within a WorkflowProvider");
  return context;
}
