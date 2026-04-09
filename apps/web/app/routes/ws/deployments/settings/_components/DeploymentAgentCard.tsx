import {
  SiArgo,
  SiArgoHex,
  SiGithub,
  SiTerraform,
  SiTerraformHex,
} from "@icons-pack/react-simple-icons";
import { Expand, PlayIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { ConfigEntry } from "~/components/config-entry";

type JobAgent = {
  id: string;
  name: string;
  type: string;
  config: Record<string, any>;
};

function TypeIcon({ type }: { type: string }) {
  if (type === "github-app") return <SiGithub className="size-8" />;
  if (type === "argo-cd")
    return <SiArgo className="size-8" color={SiArgoHex} />;
  if (type === "tfe")
    return <SiTerraform className="size-8" color={SiTerraformHex} />;
  return <PlayIcon className="size-8" />;
}

function ConfigExpanded({
  config,
  label,
}: {
  config: Record<string, any>;
  label: string;
}) {
  const entries = Object.entries(config);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <Expand className="size-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[1000px] sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-auto rounded-md border border-muted-foreground/20 p-2">
          {entries.map(([key, value]) => (
            <ConfigEntry key={key} entryKey={key} value={value} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Config({
  config,
  label,
}: {
  config: Record<string, any>;
  label: string;
}) {
  const entries = Object.entries(config);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        {label}
        <ConfigExpanded config={config} label={label} />
      </div>
      <div className="max-h-60 overflow-auto rounded-md border border-muted-foreground/20 p-2">
        {entries.map(([key, value]) => (
          <ConfigEntry key={key} entryKey={key} value={value} />
        ))}
      </div>
    </div>
  );
}

export function DeploymentAgentCard({ agent }: { agent: JobAgent }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeIcon type={agent.type} />
          {agent.name}
        </CardTitle>
        <CardDescription>{agent.type}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 text-xs">
        <Config config={agent.config} label="Agent Config" />
      </CardContent>
    </Card>
  );
}
