import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconTopologyComplex } from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";

import { CreateTargetDialog } from "../../_components/CreateTarget";

export const TargetGettingStarted: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconTopologyComplex className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Targets</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Targets are the destinations where your jobs are executed. They can
            represent a wide range of entities, from a traditional
            infrastructure target like an EKS cluster to a more abstract target
            like a Salesforce account.
          </p>
          <p>
            To keep the status of targets up-to-date, they should be created by
            providers. You can then attach metadata to these targets, allowing
            Environments to easily filter and include them in specific
            workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateTargetDialog workspace={workspace}>
            <Button size="sm">Register Target</Button>
          </CreateTargetDialog>
          <Link
            href="https://docs.ctrlplane.dev/core-concepts/targets"
            target="_blank"
            passHref
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Documentation
          </Link>
        </div>
      </div>
    </div>
  );
};
