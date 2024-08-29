import Link from "next/link";
import { useParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
import { Button } from "@ctrlplane/ui/button";

export const JobAgentMissingAlert: React.FC = () => {
  const params = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    deploymentSlug: string;
  }>();
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
        href={`/${params.workspaceSlug}/systems/${params.systemSlug}/deployments/${params.deploymentSlug}/configure/job-agent`}
        passHref
      >
        <Button variant="destructive" size="sm">
          Configure
        </Button>
      </Link>
    </Alert>
  );
};
