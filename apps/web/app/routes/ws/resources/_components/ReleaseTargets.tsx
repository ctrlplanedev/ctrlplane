import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { Copy } from "lucide-react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
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

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
function key(releaseTarget: ReleaseTarget) {
  const { resource, environment, deployment } = releaseTarget;
  return `${resource.id}-${environment.id}-${deployment.id}`;
}
function CopyTargetKey({ releaseTarget }: { releaseTarget: ReleaseTarget }) {
  const [, copy] = useCopyToClipboard();
  const onClick = () => {
    copy(key(releaseTarget));
    toast.success("Release target key copied to clipboard");
  };

  return (
    <div className="flex w-full justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        className="flex h-8 items-center gap-2"
      >
        <span className="text-xs text-muted-foreground ">Copy key</span>
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

function ReleaseTargetTable({
  releaseTargets,
}: {
  releaseTargets: ReleaseTarget[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Deployment</TableHead>
          <TableHead>Environment</TableHead>
          <TableHead>Version</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {releaseTargets.map((releaseTarget) => (
          <TableRow key={key(releaseTarget)}>
            <TableCell>{releaseTarget.deployment.name}</TableCell>
            <TableCell>{releaseTarget.environment.name}</TableCell>
            <TableCell>
              {releaseTarget.state.currentRelease?.version.tag ?? "-"}
            </TableCell>
            <TableCell>
              <CopyTargetKey releaseTarget={releaseTarget} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
          <ReleaseTargetTable releaseTargets={releaseTargets} />
        )}
      </CardContent>
    </Card>
  );
}
