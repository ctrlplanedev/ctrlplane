"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import Link from "next/link";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import { Card } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { VersionSelectorRuleDialog } from "~/app/[workspaceSlug]/(app)/_components/policy/version-selector/RuleDialog";
import { api } from "~/trpc/react";

// Define the required Policy type with a non-null selector
type Policy = RouterOutputs["policy"]["list"][number];
interface PolicyWithVersionSelector extends Policy {
  deploymentVersionSelector: NonNullable<Policy["deploymentVersionSelector"]>;
}

interface VersionSelectorRuleTableProps {
  policies: PolicyWithVersionSelector[];
}

export function VersionSelectorRuleTable({
  policies,
}: VersionSelectorRuleTableProps) {
  const queryClient = useQueryClient();
  // Adjust query key if needed based on workspaceId context if list is filtered server-side
  const listPoliciesQueryKey = getQueryKey(api.policy.list);

  const [policyToDelete, setPolicyToDelete] =
    useState<PolicyWithVersionSelector | null>(null);
  const [policyToEdit, setPolicyToEdit] =
    useState<PolicyWithVersionSelector | null>(null);

  const deleteMutation = api.policy.deleteDeploymentVersionSelector.useMutation(
    {
      onSuccess: (_, _variables) => {
        toast.success("Version selector rule deleted successfully");
        // Consider invalidating by workspaceId if list was fetched with it
        queryClient.invalidateQueries({ queryKey: listPoliciesQueryKey });
        setPolicyToDelete(null);
      },
      onError: (error) => {
        toast.error(`Failed to delete rule: ${error.message}`);
        setPolicyToDelete(null);
      },
    },
  );

  const handleDelete = () => {
    if (policyToDelete) {
      deleteMutation.mutate({ policyId: policyToDelete.id });
    }
  };

  if (policies.length === 0) {
    // This case should technically be handled by the parent page now,
    // but include a fallback just in case.
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No policies with Version Selector rules found.
      </p>
    );
  }

  return (
    <AlertDialog
      open={policyToDelete !== null}
      onOpenChange={(open) => !open && setPolicyToDelete(null)}
    >
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead>Rule Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell className="font-medium">
                  {/* Link to the specific policy page */}
                  <Link
                    href={`/${policy.workspaceId}/policies/${policy.id}`}
                    className="hover:underline"
                  >
                    {policy.name}
                  </Link>
                </TableCell>
                <TableCell>{policy.deploymentVersionSelector.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {policy.deploymentVersionSelector.description}
                </TableCell>
                <TableCell>
                  {policy.enabled ? (
                    <Badge variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPolicyToEdit(policy)}
                  >
                    <IconEdit className="h-4 w-4" />
                  </Button>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPolicyToDelete(policy)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            version selector rule associated with the policy "
            <strong>{policyToDelete?.name}</strong>".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button asChild variant="destructive">
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Rule"}
            </AlertDialogAction>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>

      {/* Edit Dialog */}
      {policyToEdit && (
        <VersionSelectorRuleDialog
          policy={policyToEdit}
          open={true}
          onOpenChange={(open) => !open && setPolicyToEdit(null)}
        />
      )}
    </AlertDialog>
  );
}
