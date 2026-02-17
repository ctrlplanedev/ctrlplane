import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { useWorkspace } from "~/components/WorkspaceProvider";

type RedeployDialogProps = {
  releaseTarget: ReleaseTarget;
  resourceIdentifier: string;
};

type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTarget"];

const useRedeploy = (releaseTarget: ReleaseTarget, onClose: () => void) => {
  const { workspace } = useWorkspace();
  const redeploy = trpc.redeploy.releaseTarget.useMutation();
  const handleRedeploy = () =>
    redeploy
      .mutateAsync({ workspaceId: workspace.id, releaseTarget })
      .then(() => toast.success("Successfully queued redeploy"))
      .then(() => onClose())
      .catch((error) =>
        toast.error("Failed to queue redeploy", {
          description: error.message,
        }),
      );
  return { handleRedeploy, isPending: redeploy.isPending };
};

const useDeployment = (deploymentId: string) => {
  const { data: deployment, isLoading } = trpc.deployment.get.useQuery({
    deploymentId,
  });
  return { deployment, isLoading };
};

function DeploymentBadge({ deploymentId }: { deploymentId: string }) {
  const { deployment, isLoading } = useDeployment(deploymentId);
  if (isLoading) return <Skeleton className="h-4 w-20" />;
  if (!deployment) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      {deployment.name}
    </Badge>
  );
}

const useResource = (identifier: string) => {
  const { workspace } = useWorkspace();
  const { data: resource, isLoading } = trpc.resource.get.useQuery({
    workspaceId: workspace.id,
    identifier,
  });
  return { resource, isLoading };
};

function ResourceBadge({ resourceIdentifier }: { resourceIdentifier: string }) {
  const { workspace } = useWorkspace();
  const { resource, isLoading } = useResource(resourceIdentifier);
  if (isLoading) return <Skeleton className="h-4 w-20" />;
  if (!resource) return null;
  return (
    <a
      href={`/${workspace.slug}/resources/${encodeURIComponent(resourceIdentifier)}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Badge
        className="cursor-pointer text-xs hover:bg-accent"
        variant="outline"
      >
        {resource.name}
      </Badge>
    </a>
  );
}

function key(releaseTarget: ReleaseTarget) {
  const { resourceId, environmentId, deploymentId } = releaseTarget;
  return `${resourceId}-${environmentId}-${deploymentId}`;
}

const useReleaseTargetPolicies = (releaseTargetKey: string) => {
  const { workspace } = useWorkspace();
  const { data: policies, isLoading } = trpc.releaseTargets.policies.useQuery({
    workspaceId: workspace.id,
    releaseTargetKey,
  });
  return { policies, isLoading };
};

function getRuleType(rule: WorkspaceEngine["schemas"]["PolicyRule"]): string {
  if (rule.anyApproval != null) return "approval";
  if (rule.deploymentDependency != null) return "deployment dependency";
  if (rule.deploymentWindow != null) return "deployment window";
  if (rule.environmentProgression != null) return "environment progression";
  if (rule.gradualRollout != null) return "gradual rollout";
  if (rule.retry != null) return "retry";
  if (rule.verification != null) return "verification";
  if (rule.versionCooldown != null) return "version cooldown";
  if (rule.versionSelector != null) return "version selector";
  return "unknown";
}

function ReleaseTargetPolicies({
  releaseTargetKey,
}: {
  releaseTargetKey: string;
}) {
  const { policies, isLoading } = useReleaseTargetPolicies(releaseTargetKey);
  if (isLoading) return <Skeleton className="h-4 w-20" />;
  if (!policies) return null;
  return (
    <div className="flex flex-col gap-2">
      {policies.map((policy) => (
        <div key={policy.id} className="flex flex-col gap-1">
          <span className="text-sm font-medium">{policy.name}</span>
          <div className="flex flex-col gap-2">
            {policy.rules.map((rule) => (
              <span key={rule.id} className="text-xs">
                {getRuleType(rule)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RedeployDialog({
  releaseTarget,
  resourceIdentifier,
}: RedeployDialogProps) {
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);
  const { handleRedeploy, isPending } = useRedeploy(releaseTarget, onClose);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="h-6 w-fit rounded-sm border border-neutral-200 px-2 py-2 text-xs dark:border-neutral-700"
        >
          Redeploy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeploy release target</DialogTitle>
          <DialogDescription className="flex flex-col gap-1.5">
            <span>
              Are you sure you want to redeploy this release target? Redeploying
              does not override any active policies.
            </span>
            <div className="flex gap-1">
              <DeploymentBadge deploymentId={releaseTarget.deploymentId} />
              <ResourceBadge resourceIdentifier={resourceIdentifier} />
            </div>
          </DialogDescription>
        </DialogHeader>

        <ReleaseTargetPolicies releaseTargetKey={key(releaseTarget)} />

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleRedeploy} disabled={isPending}>
            Redeploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
