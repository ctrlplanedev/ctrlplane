import { IconAffiliate } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const DependenciesGettingStarted: React.FC = () => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconAffiliate className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Deployment Dependencies</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            When creating releases for a deployment, you can set dependencies to
            ensure that a specific version of a different deployment is
            successfully deployed before running this pipeline. This allows you
            to manage complex deployment scenarios where certain resources or
            services need to be available and in a specific state before
            proceeding with the next step.
          </p>
          <p>
            Deployment dependencies provide a way to orchestrate the order and
            flow of your deployments, ensuring that the necessary prerequisites
            are met before executing each stage. This helps maintain
            consistency, reduce errors, and streamline the overall deployment
            process.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
