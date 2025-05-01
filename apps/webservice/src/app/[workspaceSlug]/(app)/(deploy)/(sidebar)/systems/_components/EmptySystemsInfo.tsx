import type * as SCHEMA from "@ctrlplane/db/schema";
import Link from "next/link";
import { IconTopologyComplex } from "@tabler/icons-react";

import { Button, buttonVariants } from "@ctrlplane/ui/button";

import { CreateSystemDialog } from "../CreateSystem";

export const EmptySystemsInfo: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => (
  <div className="h-full w-full p-20">
    <div className="container m-auto max-w-xl space-y-6 p-20">
      <div className="relative -ml-1 text-neutral-500">
        <IconTopologyComplex className="h-10 w-10" strokeWidth={0.5} />
      </div>
      <div className="font-semibold">Systems</div>
      <div className="prose prose-invert text-sm text-muted-foreground">
        <p>
          Systems serve as a high-level category or grouping for your
          deployments. A system encompasses a set of related deployments that
          share common characteristics, such as the same environments and
          environment policies.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CreateSystemDialog workspace={workspace}>
          <Button size="sm">Create System</Button>
        </CreateSystemDialog>
        <Link
          href="https://docs.ctrlplane.dev/core-concepts/systems"
          target="_blank"
          passHref
          className={buttonVariants({
            variant: "outline",
            size: "sm",
          })}
        >
          Documentation
        </Link>
      </div>
    </div>
  </div>
);
