import Link from "next/link";
import { TbBook } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

export const RunbookGettingStarted: React.FC<{
  workspaceSlug: string;
  systemSlug: string;
}> = ({ workspaceSlug, systemSlug }) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbBook className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Runbooks</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Runbooks in Ctrlplane trigger pipelines that you can control and
            manage in one centralized place. They allow you to select specific
            targets for pipeline execution and can be scheduled to run
            automatically, streamlining your operational processes. This
            centralized approach to pipeline management enhances efficiency and
            provides greater control over your automated workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${workspaceSlug}/systems/${systemSlug}/runbooks/create`}
            passHref
          >
            <Button size="sm">Create Runbook</Button>
          </Link>
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
