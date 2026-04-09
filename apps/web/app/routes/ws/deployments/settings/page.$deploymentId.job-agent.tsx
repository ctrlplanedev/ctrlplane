import { trpc } from "~/api/trpc";
import { Skeleton } from "~/components/ui/skeleton";
import { useDeployment } from "../_components/DeploymentProvider";
import { DeploymentAgentCard } from "./_components/DeploymentAgentCard";

export default function DeploymentJobAgentPage() {
  const { deployment } = useDeployment();
  const { data: agents, isLoading } = trpc.deployment.jobAgents.useQuery({
    deploymentId: deployment.id,
  });

  return (
    <div className="m-8 max-w-3xl justify-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Job Agents</h2>
        <p className="text-sm text-muted-foreground">
          Job agents matched by this deployment's selector. Without a matching
          agent, new deployment versions will not take any action.
        </p>
        {deployment.jobAgentSelector != null &&
          deployment.jobAgentSelector !== "false" && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Selector</h4>
              <pre className="rounded-md bg-muted p-3 font-mono text-xs">
                {deployment.jobAgentSelector}
              </pre>
            </div>
          )}
      </div>

      {isLoading && (
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!isLoading && agents != null && agents.length > 0 && (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <DeploymentAgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {!isLoading && (agents == null || agents.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No job agents match the current selector.
        </p>
      )}
    </div>
  );
}
