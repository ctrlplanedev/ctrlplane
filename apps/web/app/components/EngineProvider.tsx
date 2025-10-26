import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "./WorkspaceProvider";

// Define the WorkspaceContext type and default value
type EngineContextType = {
  status: {
    healthy?: boolean;
    message?: string;
  };
};

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export function EngineProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  const { data: engine } = trpc.workspace.engineStatus.useQuery(
    { workspaceId: workspace.id },
    { refetchInterval: 1000 },
  );
  return (
    <EngineContext.Provider
      value={{
        status: engine ?? { healthy: false, message: "Engine not found" },
      }}
    >
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
