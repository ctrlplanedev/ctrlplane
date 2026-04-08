import { useDeployment } from "../_components/DeploymentProvider";

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
    </div>
  );
}
