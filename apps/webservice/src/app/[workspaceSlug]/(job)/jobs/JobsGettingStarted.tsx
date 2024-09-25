import { IconSend } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const JobsGettingStarted: React.FC = () => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconSend className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Jobs</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Jobs are the core units of work in Ctrlplane. They represent
            specific tasks or processes that need to be executed across your
            infrastructure. Jobs can be anything from deploying an application
            or performing system maintenance via runbooks.
          </p>
          <p>
            With Ctrlplane, you can define, schedule, and monitor jobs across
            various environments and targets. Jobs provide a standardized way to
            manage and track your operations, ensuring consistency and
            reliability across your entire infrastructure.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary">
            View Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
