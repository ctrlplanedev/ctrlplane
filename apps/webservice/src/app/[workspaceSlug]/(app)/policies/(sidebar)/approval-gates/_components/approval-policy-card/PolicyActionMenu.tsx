"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconDotsVertical, IconEdit, IconTrash } from "@tabler/icons-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const DeletePolicyDialog: React.FC<{
  policy: RouterOutputs["policy"]["list"][number];
  children: React.ReactNode;
  onClose: () => void;
}> = ({ policy, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const deletePolicy = api.policy.delete.useMutation();

  const onDelete = () =>
    deletePolicy.mutateAsync(policy.id).then(() => {
      router.refresh();
      setOpen(false);
      onClose();
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Policy</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the policy "{policy.name}"? This
            action cannot be undone. This will trigger a reevaluation of all
            release targets affected by this policy.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            Delete Policy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const DeleteApprovalRulesDialog: React.FC<{
  policy: RouterOutputs["policy"]["list"][number];
  children: React.ReactNode;
  onClose: () => void;
}> = ({ policy, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const deleteApprovalRules = api.policy.approval.deleteAllRules.useMutation();
  const router = useRouter();

  const onDelete = () =>
    deleteApprovalRules.mutateAsync(policy.id).then(() => {
      router.refresh();
      setOpen(false);
      onClose();
    });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Approval Rules</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete all approval rules for the policy "
          {policy.name}"? This action cannot be undone. This will trigger a
          reevaluation of all release targets affected by this policy.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete}>
            Delete Approval Rules
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type PolicyActionMenuProps = {
  policy: RouterOutputs["policy"]["list"][number];
  workspaceSlug: string;
};

export const PolicyActionMenu: React.FC<PolicyActionMenuProps> = ({
  policy,
  workspaceSlug,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-neutral-800/50 hover:text-foreground">
        <IconDotsVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link
            href={urls
              .workspace(workspaceSlug)
              .policies()
              .edit(policy.id)
              .qualitySecurity()}
            className="flex cursor-pointer items-center gap-2"
          >
            <IconEdit className="h-4 w-4" />
            <span>Edit Policy</span>
          </Link>
        </DropdownMenuItem>
        <DeleteApprovalRulesDialog
          policy={policy}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 text-amber-500"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4" />
            <span>Delete Approval Rules</span>
          </DropdownMenuItem>
        </DeleteApprovalRulesDialog>
        <DeletePolicyDialog policy={policy} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 text-red-500"
            onSelect={(e) => e.preventDefault()}
          >
            <IconTrash className="h-4 w-4" />
            <span>Delete Policy</span>
          </DropdownMenuItem>
        </DeletePolicyDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
