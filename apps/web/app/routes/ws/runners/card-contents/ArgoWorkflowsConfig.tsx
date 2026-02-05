import { z } from "zod";

export const argoWorkflowsJobAgentConfig = z
  .object({
    type: z.literal("argo-workflows"),
    serverUrl: z.string(),
    apiKey: z.string(),
    namespace: z.string().optional(),
  })
  .passthrough();

type ArgoWorkflowsConfig = z.infer<typeof argoWorkflowsJobAgentConfig>;

export function ArgoWorkflowsConfig({ config }: { config: ArgoWorkflowsConfig }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Server URL</span>
        <a
          href={`https://${config.serverUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {config.serverUrl}
        </a>
      </div>
      {config.namespace && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Namespace</span>
          <span className="font-mono">{config.namespace}</span>
        </div>
      )}
    </div>
  );
}
