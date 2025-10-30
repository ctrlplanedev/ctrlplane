import type { RouterOutputs } from "@ctrlplane/trpc";
import { useState } from "react";
import { format } from "date-fns";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button, buttonVariants } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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

function PolicyRow({
  policy,
  onDelete,
}: {
  policy: Policy;
  onDelete: () => void;
}) {
  // Count release targets from computed relationships
  const releaseTargetCount = 0;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{policy.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {policy.description ?? "—"}
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
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function DeletePolicyDialog({
  policy,
  open,
  onOpenChange,
}: {
  policy: Policy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();
  const deletePolicyMutation = trpc.policies.delete.useMutation();

  if (!policy) return null;

  const handleDelete = () => {
    deletePolicyMutation
      .mutateAsync({
        workspaceId: workspace.id,
        policyId: policy.id,
      })
      .then(() => {
        utils.policies.list.invalidate({ workspaceId: workspace.id });
        onOpenChange(false);
        toast.success("Policy deleted successfully");
      })
      .catch((error: unknown) => {
        const message =
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : "Failed to delete policy";
        toast.error(message);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Policy</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the policy "{policy.name}"? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deletePolicyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePolicyMutation.isPending}
          >
            {deletePolicyMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Policies() {
  const { workspace } = useWorkspace();
  const [policyToDelete, setPolicyToDelete] = useState<Policy | null>(null);

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
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {total} {total === 1 ? "policy" : "policies"}
            </div>
            <a
              href={`/${workspace.slug}/policies/create`}
              className={buttonVariants({ variant: "default" })}
            >
              New Policy
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center p-6">
            <div className="text-muted-foreground">Loading policies...</div>
          </div>
        ) : policies.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 p-6">
            <div className="text-lg font-medium">No policies found</div>
            <div className="text-sm text-muted-foreground">
              Create a policy to control deployment behavior
            </div>
          </div>
        ) : (
          <>
            <Table className="border-b">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Release Targets</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((policy) => (
                    <PolicyRow
                      key={policy.id}
                      policy={policy}
                      onDelete={() => setPolicyToDelete(policy)}
                    />
                  ))}
              </TableBody>
            </Table>
          </>
        )}
      </main>

      <DeletePolicyDialog
        policy={policyToDelete}
        open={!!policyToDelete}
        onOpenChange={(open) => {
          if (!open) setPolicyToDelete(null);
        }}
      />
    </>
  );
}
