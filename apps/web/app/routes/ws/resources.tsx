import { useState } from "react";
import {
  Edit,
  MoreVertical,
  Search,
  Server,
  Trash2,
  Upload,
} from "lucide-react";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";

type Resource = {
  id: string;
  name: string;
  type: string;
  status: "active" | "inactive" | "pending";
  region: string;
  lastUpdated: string;
  description: string;
};

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

  const getStatusColor = (status: Resource["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
      case "inactive":
        return "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20";
      default:
        return "";
    }
  };

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
      </header>

      <div className="flex flex-1 flex-col gap-4">
        <div className="flex-1 space-y-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-sm">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Region</TableHead>
                <TableHead className="text-muted-foreground">
                  Last Updated
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Server className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No resources found
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredResources?.map((resource) => (
                  <TableRow key={resource.id}>
                    <TableCell className="font-medium">
                      {resource.name}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{resource.kind}</div>
                        <div className="text-xs text-muted-foreground">
                          {resource.version}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getStatusColor("active")}
                      >
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>{resource.workspaceId}</TableCell>
                    <TableCell>
                      {new Date(resource.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Upload className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
