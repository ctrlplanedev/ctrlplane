import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { SiArgo, SiGithub, SiTerraform } from "@icons-pack/react-simple-icons";
import { PlayIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  ArgoCDConfig,
  argoCdJobAgentConfig,
} from "./card-contents/ArgoCDConfig";
import { CopyIdSection } from "./card-contents/CopyID";
import {
  GithubConfig,
  githubJobAgentConfig,
} from "./card-contents/GithubConfig";
import { TfeConfig, tfeJobAgentConfig } from "./card-contents/TfeConfig";
import { JobAgentActions } from "./JobAgentActions";

type JobAgent = WorkspaceEngine["schemas"]["JobAgent"];
type JobAgentConfig = JobAgent["config"];

function ConfigSection({ config, id }: { config: JobAgentConfig; id: string }) {
  const argoCdParseResult = argoCdJobAgentConfig.safeParse(config);
  if (argoCdParseResult.success)
    return (
      <div className="space-y-2 text-xs">
        <CopyIdSection id={id} />
        <ArgoCDConfig config={argoCdParseResult.data} />
      </div>
    );

  const githubParseResult = githubJobAgentConfig.safeParse(config);
  if (githubParseResult.success)
    return (
      <div className="space-y-2 text-xs">
        <CopyIdSection id={id} />
        <GithubConfig config={githubParseResult.data} />
      </div>
    );

  const tfeParseResult = tfeJobAgentConfig.safeParse(config);
  if (tfeParseResult.success)
    return (
      <div className="space-y-2 text-xs">
        <CopyIdSection id={id} />
        <TfeConfig config={tfeParseResult.data} />
      </div>
    );

  const entries = Object.entries(config);
  if (entries.length === 0) return null;

  return (
    <Card className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-muted overflow-auto rounded-md bg-accent p-2">
      <CardContent className="space-y-0.5 p-0">
        {entries
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, value]) => (
            <div
              key={key}
              className="flex items-start gap-2 font-mono text-xs font-semibold"
            >
              <span className="shrink-0 text-red-600">{key}:</span>
              <pre className="text-green-700">
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function TypeIcon({ config }: { config: JobAgentConfig }) {
  const githubParseResult = githubJobAgentConfig.safeParse(config);
  if (githubParseResult.success) return <SiGithub className="size-4" />;

  const argoCdParseResult = argoCdJobAgentConfig.safeParse(config);
  if (argoCdParseResult.success)
    return <SiArgo className="size-4 text-orange-400" />;

  const tfeParseResult = tfeJobAgentConfig.safeParse(config);
  if (tfeParseResult.success)
    return <SiTerraform className="size-4 text-purple-400" />;

  return <PlayIcon className="size-4" />;
}

export function JobAgentCard({ jobAgent }: { jobAgent: JobAgent }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeIcon {...jobAgent} />
          {jobAgent.name}
          <div className="grow" />
          <JobAgentActions jobAgent={jobAgent} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConfigSection {...jobAgent} />
      </CardContent>
    </Card>
  );
}
