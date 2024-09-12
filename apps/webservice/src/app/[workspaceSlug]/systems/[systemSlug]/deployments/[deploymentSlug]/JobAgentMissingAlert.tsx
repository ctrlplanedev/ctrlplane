import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";

export const JobAgentMissingAlert: React.FC<{
  workspaceSlug: string;
  systemSlug: string;
  deploymentSlug: string;
}> = ({ workspaceSlug, systemSlug, deploymentSlug }) => {
  return (
    <Alert className="space-y-2 border-red-400 text-red-300">
      <AlertTitle className="font-semibold">
        Job agent not configured
      </AlertTitle>
      <AlertDescription>
        Job agents are used to dispatch job executions to the correct service.
        Without an agent new releases will not take any action.
      </AlertDescription>
      <Link
        className="block"
        href={`/${workspaceSlug}/systems/${systemSlug}/deployments/${deploymentSlug}/configure/job-agent`}
        passHref
      >
        <Button variant="destructive" size="sm">
          Configure
        </Button>
      </Link>
    </Alert>
  );
};
