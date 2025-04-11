"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { IconSchema } from "@tabler/icons-react";

import { Button } from "@ctrlplane/ui/button";

export const ResourceSchemasGettingStarted: React.FC<{
  workspace: Workspace;
}> = () => {
  return (
    <div className="h-full w-full p-20">
      <div className="container m-auto max-w-xl space-y-6 p-20">
        <div className="relative -ml-1 text-neutral-500">
          <IconSchema className="h-10 w-10" strokeWidth={0.5} />
        </div>
        <div className="font-semibold">Resource Schemas</div>
        <div className="prose prose-invert text-sm text-muted-foreground">
          <p>
            Resource schemas define the structure and validation rules for your
            resources. They help ensure consistency and provide a way to
            validate resource configurations before they are applied to your
            infrastructure.
          </p>
          <p>
            Each schema is associated with a specific resource kind and version,
            allowing you to maintain different versions of your resource
            definitions as your infrastructure evolves.
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
