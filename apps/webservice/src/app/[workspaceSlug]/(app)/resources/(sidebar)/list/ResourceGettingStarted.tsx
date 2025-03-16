import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconTopologyComplex } from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";

import { CreateResourceDialog } from "../../../_components/CreateResource";

export const ResourceGettingStarted: React.FC<{ workspace: Workspace }> = ({
  workspace,
}) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconTopologyComplex className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Resources</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Resources are the destinations where your jobs are executed. They
            can represent a wide range of entities, from a traditional
            infrastructure resource like an EKS cluster to a more abstract
            resource like a Salesforce account.
          </p>
          <p>
            To keep the status of resources up-to-date, they should be created
            by providers. You can then attach metadata to these resources,
            allowing Environments to easily filter and include them in specific
            workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateResourceDialog workspace={workspace}>
            <Button size="sm">Register Resource</Button>
          </CreateResourceDialog>
          <Link
            href="https://docs.ctrlplane.dev/core-concepts/resources"
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
