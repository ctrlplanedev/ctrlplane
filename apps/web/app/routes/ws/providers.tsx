import { useState } from "react";
import { Cloud, MoreVertical, Plus, Search, Trash2 } from "lucide-react";

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

export function meta() {
  return [
    { title: "Providers - Ctrlplane" },
    {
      name: "description",
      content: "Manage your resource providers",
    },
  ];
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export default function Providers() {
  const { workspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");

  const providers = trpc.resourceProviders.list.useQuery({
    workspaceId: workspace.id,
    limit: 1000,
    offset: 0,
  });

  const items = providers.data?.items ?? [];

  const filteredProviders = items.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Object.entries(provider.metadata).some(
        ([key, value]) =>
          key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(value).toLowerCase().includes(searchQuery.toLowerCase()),
      ),
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
                <BreadcrumbPage>Providers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex min-w-[350px] items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {filteredProviders.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-4">
                <Cloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">No providers found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Get started by adding your first provider"}
                </p>
              </div>
              {!searchQuery && (
                <Button className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Provider
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-muted-foreground">
                  Provider
                </TableHead>
                <TableHead className="text-muted-foreground">
                  Metadata
                </TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProviders.map((provider) => (
                <TableRow key={provider.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Cloud className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {provider.id.slice(0, 8)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(provider.metadata)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="text-xs"
                          >
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      {Object.keys(provider.metadata).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{Object.keys(provider.metadata).length - 3}
                        </Badge>
                      )}
                      {Object.keys(provider.metadata).length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          No metadata
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(provider.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
