import prettyMs from "pretty-ms";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
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

export default function Jobs() {
  const { workspace } = useWorkspace();
  const jobQuery = trpc.jobs.list.useQuery({
    workspaceId: workspace.id,
  });

  const jobs = jobQuery.data?.items ?? [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Jobs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-muted-foreground">ID</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Created At</TableHead>
            <TableHead className="text-muted-foreground">Updated At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map(({ job }) => {
            return (
              <TableRow key={job.id}>
                <TableCell className="font-mono">{job.id}</TableCell>
                <TableCell>{job.status}</TableCell>
                <TableCell>
                  {prettyMs(
                    new Date(job.createdAt).getTime() -
                      new Date(job.updatedAt).getTime(),
                  )}
                </TableCell>
                <TableCell>
                  {prettyMs(
                    new Date(job.updatedAt).getTime() -
                      new Date(job.createdAt).getTime(),
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
