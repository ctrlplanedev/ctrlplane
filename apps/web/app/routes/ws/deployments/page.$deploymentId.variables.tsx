import { DeploymentPageHeader } from "./_components/DeploymentPageHeader";
import { useDeployment } from "./_components/DeploymentProvider";
import { DeploymentVariableSection } from "./_components/variables/DeploymentVariableSection";

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

  const sortedVariables = variables.sort((a, b) =>
    a.variable.key.localeCompare(b.variable.key),
  );

  return (
    <div className="space-y-4 p-4">
      {sortedVariables.map((variable) => (
        <DeploymentVariableSection
          key={variable.variable.id}
          variable={variable}
        />
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
