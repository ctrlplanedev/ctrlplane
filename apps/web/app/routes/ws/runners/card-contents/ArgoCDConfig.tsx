import { z } from "zod";

export const argoCdJobAgentConfig = z
  .object({
    serverUrl: z.string(),
    apiKey: z.string(),
  })
  .passthrough();

type ArgoCDConfig = z.infer<typeof argoCdJobAgentConfig>;

export function ArgoCDConfig({ config }: { config: ArgoCDConfig }) {
  return (
    <div className="flex items-center justify-between text-xs">
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
  );
}
