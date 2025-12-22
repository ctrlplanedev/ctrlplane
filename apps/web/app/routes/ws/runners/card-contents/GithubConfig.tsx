import { z } from "zod";

export const githubJobAgentConfig = z.object({
  installationId: z.number(),
  owner: z.string(),
});

type GithubConfig = z.infer<typeof githubJobAgentConfig>;

export function GithubConfig({ config }: { config: GithubConfig }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Organization</span>
        <a
          href={`https://github.com/${config.owner}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {config.owner}
        </a>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Installation</span>
        <a
          href={`https://github.com/settings/installations/${config.installationId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {config.installationId}
        </a>
      </div>
    </div>
  );
}
