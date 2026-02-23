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
import { Skeleton } from "~/components/ui/skeleton";
import { useJobAgent } from "../_hooks/job-agents";

type DeploymentJobAgent = {
  ref: string;
  config: Record<string, any>;
  selector: string;
};

type DeploymentAgentCardProps = {
  deploymentAgent: DeploymentJobAgent;
};
function TypeIcon({ type }: { type: string }) {
  if (type === "github-app") return <SiGithub className="size-8" />;
  if (type === "argo-cd")
    return <SiArgo className="size-8" color={SiArgoHex} />;
  if (type === "tfe")
    return <SiTerraform className="size-8" color={SiTerraformHex} />;
  return <PlayIcon className="size-8" />;
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-4 w-24" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-24" />
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
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
            <div
              key={key}
              className="flex items-start gap-2 font-mono font-semibold"
            >
              <span className="shrink-0 text-red-600">{key}:</span>
              <pre className="text-green-700">
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </pre>
            </div>
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
          <div
            key={key}
            className="flex items-start gap-2 font-mono font-semibold"
          >
            <span className="shrink-0 text-red-600">{key}:</span>
            <pre className="text-green-700">
              {typeof value === "string"
                ? value
                : JSON.stringify(value, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeploymentAgentCard({
  deploymentAgent,
}: DeploymentAgentCardProps) {
  const { jobAgent, isLoading } = useJobAgent(deploymentAgent.ref);
  if (isLoading) return <SkeletonCard />;
  if (jobAgent == null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TypeIcon {...jobAgent} />
          {jobAgent.name}
        </CardTitle>
        <CardDescription>{jobAgent.type}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 text-xs">
        <Config config={jobAgent.config} label="Job Agent Config" />
        <Config
          config={deploymentAgent.config}
          label="Deployment Agent Config"
        />
      </CardContent>
    </Card>
  );
}
