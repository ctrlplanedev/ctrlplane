import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { useDeployment } from "../_components/DeploymentProvider";
import { DeploymentAgentCard } from "./_components/DeploymentAgentCard";

export default function DeploymentJobAgentPage() {
  const { deployment } = useDeployment();

  return (
    <div className="m-8 max-w-3xl justify-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Job Agents</h2>
        <p className="text-sm text-muted-foreground">
          Job agents are used to dispatch jobs to the correct service. Without
          an agent new deployment versions will not take any action.
        </p>
      </div>

      {deployment.jobAgents.length === 0 && (
        <Alert className="space-y-2 border-red-400 text-red-300">
          <AlertTitle className="font-semibold">
            No job agents configured
          </AlertTitle>
          <AlertDescription>
            Job agents are used to dispatch jobs to the correct service. Without
            any agents new deployment versions will not take any action.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        {deployment.jobAgents.map((deploymentAgent) => (
          <DeploymentAgentCard
            key={deploymentAgent.ref}
            deploymentAgent={deploymentAgent}
          />
        ))}
      </div>
    </div>
  );
}
