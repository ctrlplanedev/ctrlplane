import Link from "next/link";
import { IconSend2 } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const JobAgentsGettingStarted: React.FC<{
  workspaceSlug: string;
}> = ({ workspaceSlug }) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconSend2 className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Job Agents</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Job Agents are responsible for dispatching jobs to various CI/CD
            tools and monitoring those pipelines for updates. They act as
            intermediaries between your Ctrlplane workspace and your CI/CD
            infrastructure.
          </p>
          <p>
            These agents connect to your preferred CI/CD tools, such as Jenkins,
            GitLab CI, or GitHub Actions, and manage the execution of jobs. They
            also provide real-time updates on job status, allowing you to track
            the progress of your pipelines directly from Ctrlplane.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${workspaceSlug}/job-agents/integrations`}>
            <Button size="sm">Setup Job Agent</Button>
          </Link>
          <Button size="sm" variant="secondary">
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
};
