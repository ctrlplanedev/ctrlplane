import { IconShip } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { CreateDeploymentDialog } from "../../../_components/CreateDeployment";

export const DeploymentGettingStarted: React.FC<{ systemId: string }> = ({
  systemId,
}) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconShip className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Deployments</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Deployments are the core component of Ctrlplane, orchestrating the
            delivery of your applications across various environments and
            targets. They encapsulate the configuration, workflows, and triggers
            required to automate and manage the entire release lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateDeploymentDialog defaultSystemId={systemId}>
            <Button size="sm">Create Deployment</Button>
          </CreateDeploymentDialog>
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
