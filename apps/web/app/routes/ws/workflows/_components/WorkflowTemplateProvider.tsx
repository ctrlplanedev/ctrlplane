import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk"
import { createContext, useContext } from "react";

export type WorkflowTemplate = 
  WorkspaceEngine["schemas"]["WorkflowTemplate"] & {
    workflows: WorkspaceEngine["schemas"]["WorkflowWithJobs"][]
  }

type WorkflowTemplateContextType = {
  workflowTemplate: WorkflowTemplate;
}

const WorkflowTemplateContext = createContext<WorkflowTemplateContextType | undefined>(undefined);

export function WorkflowTemplateProvider({workflowTemplate, children }: { workflowTemplate: WorkflowTemplate, children: React.ReactNode }) {
  return (
    <WorkflowTemplateContext.Provider value={{ workflowTemplate }}>
      {children}
    </WorkflowTemplateContext.Provider>
  );
}

export function useWorkflowTemplate() {
  const context = useContext(WorkflowTemplateContext);
  if (context === undefined)
    throw new Error("useWorkflowTemplate must be used within a WorkflowTemplateProvider");
  return context;
}