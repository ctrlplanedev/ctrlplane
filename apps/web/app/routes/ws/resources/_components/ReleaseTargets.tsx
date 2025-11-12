import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useResource } from "./ResourceProvider";

function useReleaseTargets() {
  const { workspace } = useWorkspace();
  const { resource } = useResource();
  const { identifier } = resource;

  const { data } = trpc.resource.releaseTargets.useQuery({
    workspaceId: workspace.id,
    identifier: identifier,
    limit: 50,
    offset: 0,
  });

  return data?.items ?? [];
}

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTarget"];
function key(releaseTarget: ReleaseTarget) {
  const { resourceId, environmentId, deploymentId } = releaseTarget;
  return `${resourceId}-${environmentId}-${deploymentId}`;
}
function CopyTargetKey({ releaseTarget }: { releaseTarget: ReleaseTarget }) {
  const [, copy] = useCopyToClipboard();
  const onClick = () => {
    copy(key(releaseTarget));
    toast.success("Release target key copied to clipboard");
  };

  return (
    <Button variant="ghost" size="icon" onClick={onClick}>
      <Copy className="h-4 w-4" />
    </Button>
  );
}

export function ReleaseTargets() {
  const releaseTargets = useReleaseTargets();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Release Targets</CardTitle>
      </CardHeader>
      <CardContent>
        {releaseTargets.length === 0 && (
          <p className="text-sm text-muted-foreground">No release targets</p>
        )}
        {releaseTargets.length > 0 && (
          <div className="space-y-2 font-mono text-xs">
            {releaseTargets.map((releaseTarget) => (
              <div
                key={key(releaseTarget)}
                className="flex items-center justify-between"
              >
                <span>{key(releaseTarget)}</span>
                <CopyTargetKey releaseTarget={releaseTarget} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
