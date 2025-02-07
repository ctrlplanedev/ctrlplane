import { notFound } from "next/navigation";

import { Button } from "@ctrlplane/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { api } from "~/trpc/server";

export default async function SystemsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) notFound();

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Open popover</Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h2 className="font-medium leading-none">Dimensions</h2>
              <p className="text-sm text-muted-foreground">
                Set the dimensions for the layer.
              </p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-3 items-center gap-4"></div>
              <div className="grid grid-cols-3 items-center gap-4"></div>
              <div className="grid grid-cols-3 items-center gap-4"></div>
              <div className="grid grid-cols-3 items-center gap-4"></div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
