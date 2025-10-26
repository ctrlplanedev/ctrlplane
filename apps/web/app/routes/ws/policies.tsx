import type { RouterOutputs } from "@ctrlplane/trpc";
import { format } from "date-fns";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Card, CardContent } from "~/components/ui/card";
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
    { title: "Policies - Ctrlplane" },
    {
      name: "description",
      content: "Manage your policies",
    },
  ];
}

type Policy = NonNullable<
  NonNullable<RouterOutputs["policies"]["list"]>["policies"]
>[number];

function PolicyRow({ policy }: { policy: Policy }) {
  // Count release targets from computed relationships
  const releaseTargetCount =
    policy.targets?.reduce((sum, target) => {
      return sum + (target.computedReleaseTargets?.length ?? 0);
    }, 0) ?? 0;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{policy.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {policy.description || "—"}
      </TableCell>
      <TableCell className="text-center">{policy.priority}</TableCell>
      <TableCell>
        <Badge variant={policy.enabled ? "default" : "secondary"}>
          {policy.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-mono text-sm">
        {releaseTargetCount}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(policy.createdAt), "MMM d, yyyy")}
      </TableCell>
    </TableRow>
  );
}

export default function Policies() {
  const { workspace } = useWorkspace();

  const { data, isLoading } = trpc.policies.list.useQuery({
    workspaceId: workspace.id,
  });

  const policies = data?.policies ?? [];
  const total = policies.length;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex w-full items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Policies</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="text-sm text-muted-foreground">
            {total} {total === 1 ? "policy" : "policies"}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-muted-foreground">Loading policies...</div>
              </div>
            ) : policies.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2">
                <div className="text-lg font-medium">No policies found</div>
                <div className="text-sm text-muted-foreground">
                  Create a policy to control deployment behavior
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">
                        Release Targets
                      </TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <PolicyRow key={policy.id} policy={policy} />
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
