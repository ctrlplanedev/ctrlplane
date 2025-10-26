import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useSearchParams } from "react-router";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { CreateResourceDialog } from "./_components/CreateResourceDialog";
import { ResourceRow } from "./resources/_components/ResourceRow";

export default function Resources() {
  const { workspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  const [searchParams] = useSearchParams();
  const cel = searchParams.get("cel");

  const { data: resources } = trpc.resource.list.useQuery(
    {
      workspaceId: workspace.id,
      selector: { cel: cel ?? "true" },
      limit: 200,
      offset: 0,
    },
    { refetchInterval: 30_000 },
  );

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Resources</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <CreateResourceDialog>
            <Button variant="outline" className="h-9">
              <Plus className="h-4 w-4" />
              Create Resource
            </Button>
          </CreateResourceDialog>

          <Badge variant="outline" className="h-9">
            {resources?.total} resource{resources?.total === 1 ? "" : "s"}
          </Badge>
          <div className="flex min-w-[350px] items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </header>

      {resources?.items.map((resource) => (
        <ResourceRow
          key={
            resource.identifier + resource.name + resource.kind + resource.id
          }
          resource={resource}
        />
      ))}
    </>
  );
}
