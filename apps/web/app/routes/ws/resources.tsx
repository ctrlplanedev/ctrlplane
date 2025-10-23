import { useState } from "react";
import { Search } from "lucide-react";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ResourceRow } from "./resources/_components/ResourceRow";

export default function Resources() {
  const { workspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  const cel = `resource.name.startsWith("${searchQuery}") 
    || resource.name.endsWith("${searchQuery}") 
    || resource.name.contains("${searchQuery}")
    || resource.identifier.startsWith("${searchQuery}")
    || resource.identifier.endsWith("${searchQuery}")
    || resource.identifier.contains("${searchQuery}")`;

  const { data: resources } = trpc.resources.list.useQuery({
    workspaceId: workspace.id,
    selector: { cel },
    limit: 10,
    offset: 0,
  });

  const filteredResources = resources?.items.filter((resource) =>
    resource.name.toLowerCase().includes(searchQuery.toLowerCase()),
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

      {filteredResources?.map((resource) => (
        <ResourceRow key={resource.identifier} resource={resource} />
      ))}
    </>
  );
}
