import type { RouterOutputs } from "@ctrlplane/trpc";
import { useCallback, useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { format } from "date-fns";
import yaml from "js-yaml";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { useTheme } from "~/components/ThemeProvider";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Button, buttonVariants } from "~/components/ui/button";
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

function useReleaseTargets(policyId: string) {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.policies.releaseTargets.useQuery({
    workspaceId: workspace.id,
    policyId: policyId,
  });
  return { releaseTargets: data ?? [], isLoading };
}

type Policy = NonNullable<
  NonNullable<RouterOutputs["policies"]["list"]>["policies"]
>[number];

function PolicyRow({
  policy,
  onDelete,
  onView,
}: {
  policy: Policy;
  onDelete: () => void;
  onView: () => void;
}) {
  const { releaseTargets, isLoading } = useReleaseTargets(policy.id);
  const releaseTargetCount = releaseTargets.length;

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onView}>
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
        {isLoading ? "-" : releaseTargetCount}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(policy.createdAt), "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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

/**
 * Converts a policy object to an editable YAML representation,
 * stripping read-only fields (id, workspaceId, createdAt) from
 * both the policy and its rules.
 */
function policyToEditableYaml(policy: Policy): string {
  const { id: _id, workspaceId: _wsId, createdAt: _ca, ...editable } = policy;
  const rawRules: Record<string, unknown>[] = Array.isArray(editable.rules)
    ? (editable.rules as Record<string, unknown>[])
    : [];
  const rules = rawRules.map((rule) => {
    const { id: _rId, policyId: _pId, createdAt: _rCa, ...rest } = rule;
    return rest;
  });
  return yaml.dump({ ...editable, rules }, { lineWidth: -1 });
}

function EditPolicyDialog({
  policy,
  open,
  onOpenChange,
}: {
  policy: Policy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace } = useWorkspace();
  const { theme } = useTheme();
  const utils = trpc.useUtils();
  const upsertMutation = trpc.policies.upsert.useMutation();

  const [yamlValue, setYamlValue] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Reset editor content when the policy changes
  useEffect(() => {
    if (policy) {
      setYamlValue(policyToEditableYaml(policy));
      setParseError(null);
    }
  }, [policy]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    const next = value ?? "";
    setYamlValue(next);
    try {
      yaml.load(next);
      setParseError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid YAML";
      setParseError(message);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!policy) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = yaml.load(yamlValue) as Record<string, unknown>;
    } catch {
      toast.error("Cannot save: YAML is invalid");
      return;
    }

    const name = typeof parsed.name === "string" ? parsed.name : policy.name;
    const description =
      typeof parsed.description === "string"
        ? parsed.description
        : policy.description;
    const enabled =
      typeof parsed.enabled === "boolean" ? parsed.enabled : policy.enabled;
    const priority =
      typeof parsed.priority === "number" ? parsed.priority : policy.priority;
    const metadata =
      parsed.metadata != null &&
      typeof parsed.metadata === "object" &&
      !Array.isArray(parsed.metadata)
        ? (parsed.metadata as Record<string, string>)
        : (policy.metadata as Record<string, string>);
    const rules = Array.isArray(parsed.rules)
      ? (parsed.rules as Record<string, unknown>[])
      : (policy.rules as unknown as Record<string, unknown>[]);
    const selector =
      typeof parsed.selector === "string" ? parsed.selector : policy.selector;

    upsertMutation
      .mutateAsync({
        workspaceId: workspace.id,
        policyId: policy.id,
        body: {
          name,
          description,
          enabled,
          priority,
          metadata,
          rules,
          selector,
        },
      })
      .then(() => {
        utils.policies.list.invalidate({ workspaceId: workspace.id });
        toast.success("Policy update requested");
        onOpenChange(false);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Failed to update policy";
        toast.error(message);
      });
  }, [policy, yamlValue, workspace.id, upsertMutation, utils, onOpenChange]);

  if (!policy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Policy: {policy.name}</DialogTitle>
          <DialogDescription>
            Edit policy as YAML and save changes
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden rounded-md border">
          <Editor
            language="yaml"
            theme={theme === "dark" ? "vs-dark" : "vs"}
            value={yamlValue}
            onChange={handleEditorChange}
            height="500px"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              tabSize: 2,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        </div>
        {parseError && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {parseError}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!!parseError || upsertMutation.isPending}
          >
            {upsertMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [policyToView, setPolicyToView] = useState<Policy | null>(null);

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
                      onView={() => setPolicyToView(policy)}
                    />
                  ))}
              </TableBody>
            </Table>
          </>
        )}
      </main>

      <EditPolicyDialog
        policy={policyToView}
        open={!!policyToView}
        onOpenChange={(open) => {
          if (!open) setPolicyToView(null);
        }}
      />
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
