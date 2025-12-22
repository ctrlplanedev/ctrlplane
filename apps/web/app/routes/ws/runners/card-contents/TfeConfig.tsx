import { z } from "zod";

export const tfeJobAgentConfig = z
  .object({
    organization: z.string(),
    address: z.string(),
    token: z.string(),
  })
  .passthrough();

type TfeConfig = z.infer<typeof tfeJobAgentConfig>;

export function TfeConfig({ config }: { config: TfeConfig }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Address</span>
        <a
          href={config.address}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {config.address}
        </a>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Organization</span>
        <a
          href={`${config.address}/app/${config.organization}/workspaces`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {config.organization}
        </a>
      </div>
    </div>
  );
}
