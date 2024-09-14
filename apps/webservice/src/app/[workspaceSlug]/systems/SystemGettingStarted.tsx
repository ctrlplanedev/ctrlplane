import type { Workspace } from "@ctrlplane/db/schema";
import { TbTopologyComplex } from "react-icons/tb";

import { Button } from "@ctrlplane/ui/button";

import { CreateSystemDialog } from "../_components/CreateSystem";

export const SystemGettingStarted: React.FC<{
  workspace: Workspace;
}> = (props) => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <TbTopologyComplex className="h-10 w-10" strokeWidth={0.5} />
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
          <CreateSystemDialog {...props}>
            <Button size="sm">Create System</Button>
          </CreateSystemDialog>
          <Button size="sm" variant="secondary">
            Documentation
          </Button>
        </div>
      </div>
    </div>
  );
};
