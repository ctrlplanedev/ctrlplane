import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconWebhook } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

import { CreateLifecycleHookDialog } from "./CreateLifecycleHookDialog";

type LifecycleHooksGettingStartedProps = {
  deployment: SCHEMA.Deployment;
  runbooks: SCHEMA.Runbook[];
};

export const LifecycleHooksGettingStarted: React.FC<
  LifecycleHooksGettingStartedProps
> = ({ deployment, runbooks }) => (
  <div className="h-full w-full p-20">
    <div className="container m-auto max-w-xl space-y-6 p-20">
      <div className="relative -ml-1 text-neutral-500">
        <IconWebhook className="h-10 w-10" strokeWidth={0.5} />
      </div>
      <div className="font-semibold">Lifecycle Hooks</div>
      <div className="prose prose-invert text-sm text-muted-foreground">
        <p>
          Lifecycle hooks allow you to run runbooks at specific points in a
          deployment's lifecycle.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CreateLifecycleHookDialog
          deploymentId={deployment.id}
          runbooks={runbooks}
        >
          <Button size="sm">Create Lifecycle Hook</Button>
        </CreateLifecycleHookDialog>
        <Button size="sm" variant="secondary">
          Documentation
        </Button>
      </div>
    </div>
  </div>
);
