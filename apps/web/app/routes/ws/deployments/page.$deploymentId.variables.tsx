import { DeploymentPageHeader } from "./_components/DeploymentPageHeader";
import { useDeployment } from "./_components/DeploymentProvider";

export function meta() {
  return [
    { title: "Variables - Deployment Details - Ctrlplane" },
    { name: "description", content: "View all deployment variables" },
  ];
}

function VariablesTable() {
  const { deployment } = useDeployment();
  const { variables } = deployment;

  if (variables.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No variables configured for this deployment.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {variables.map((variable) => (
        <div key={variable.variable.id}>
          <span>{variable.variable.key}</span>
          <pre className="font-mono text-xs">
            {JSON.stringify(variable.values, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

export default function DeploymentVariables() {
  return (
    <>
      <DeploymentPageHeader />
      <VariablesTable />
    </>
  );
}
