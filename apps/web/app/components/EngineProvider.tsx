import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import "ldrs/react/Grid.css";

import { Grid } from "ldrs/react";

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
  const status = engine ?? { healthy: false, message: "Engine reloading" };
  return (
    <EngineContext.Provider value={{ status }}>
      {status.healthy ? (
        children
      ) : (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 space-y-8 rounded-lg bg-card p-12">
            <Grid size={100} speed={3} />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-medium text-foreground">
                Waiting for workspace engine...
              </p>
              <p className="text-sm text-muted-foreground">{status.message}</p>
            </div>
          </div>
        </div>
      )}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx)
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
