import Link from "next/link";
import { IconRocket } from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";

import { CreateDeploymentDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/CreateDeployment";

export const DeploymentGettingStarted: React.FC<{
  workspaceSlug: string;
  systemId: string;
}> = ({ workspaceSlug, systemId }) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconRocket className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Deployments</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Deployments represent applications, services, or infrastructure
            components that you want to manage through Ctrlplane. Each
            deployment can have multiple releases and be deployed to different
            environments.
          </p>
          <p>
            Create a deployment to start managing your release process, tracking
            versions across environments, and applying governance policies to
            your release workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateDeploymentDialog systemId={systemId}>
            <Button size="sm">Create Deployment</Button>
          </CreateDeploymentDialog>
          <Link
            href="https://docs.ctrlplane.dev/core-concepts/deployments"
            target="_blank"
            passHref
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
};
