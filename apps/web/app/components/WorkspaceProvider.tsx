import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

// Define the WorkspaceContext type and default value
type WorkspaceContextType = {
  workspace: Workspace;
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({
  children,
  workspace,
}: {
  children: ReactNode;
  workspace: Workspace;
}) {
  return (
    <WorkspaceContext.Provider value={{ workspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
