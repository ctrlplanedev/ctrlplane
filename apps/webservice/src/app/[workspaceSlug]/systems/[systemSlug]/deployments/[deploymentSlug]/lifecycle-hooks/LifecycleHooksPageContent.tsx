import type * as SCHEMA from "@ctrlplane/db/schema";

import { LifecycleHooksGettingStarted } from "./LifecycleHooksGettingStarted";
import { LifecycleHooksTable } from "./LifecycleHooksTable";

type LifecycleHooksPageContentProps = {
  deployment: SCHEMA.Deployment;
  lifecycleHooks: (SCHEMA.DeploymentLifecycleHook & {
    runbook: SCHEMA.Runbook;
  })[];
  runbooks: SCHEMA.Runbook[];
};

export const LifecycleHooksPageContent: React.FC<
  LifecycleHooksPageContentProps
> = ({ deployment, lifecycleHooks, runbooks }) => {
  if (lifecycleHooks.length === 0)
    return (
      <LifecycleHooksGettingStarted
        deployment={deployment}
        runbooks={runbooks}
      />
    );

  return (
    <LifecycleHooksTable
      deploymentId={deployment.id}
      lifecycleHooks={lifecycleHooks}
    />
  );
};
