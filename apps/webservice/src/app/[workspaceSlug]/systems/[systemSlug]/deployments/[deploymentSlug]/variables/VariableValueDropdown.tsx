import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconTarget, IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { buttonVariants } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";

import type { VariableValue } from "./variable-data";
import { TargetConditionDialog } from "~/app/[workspaceSlug]/_components/target-condition/TargetConditionDialog";
import { api } from "~/trpc/react";

const DeleteVariableValueDialog: React.FC<{
  valueId: string;
  children: React.ReactNode;
  onClose: () => void;
}> = ({ valueId, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const deleteVariableValue =
    api.deployment.variable.value.delete.useMutation();
  const router = useRouter();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose();
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Are you sure you want to delete this variable value?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex justify-end">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <div className="flex-grow" />
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() =>
              deleteVariableValue
                .mutateAsync(valueId)
                .then(() => router.refresh())
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const VariableValueDropdown: React.FC<{
  value: VariableValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  const [open, setOpen] = useState(false);
  const update = api.deployment.variable.value.update.useMutation();
  const router = useRouter();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <TargetConditionDialog
            condition={value.targetFilter ?? undefined}
            onChange={(condition) =>
              update
                .mutateAsync({
                  id: value.id,
                  data: { targetFilter: condition },
                })
                .then(() => router.refresh())
            }
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconTarget className="h-4 w-4" />
              Assign targets
            </DropdownMenuItem>
          </TargetConditionDialog>
          <DeleteVariableValueDialog
            valueId={value.id}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconTrash className="h-4 w-4 text-red-500" />
              Delete
            </DropdownMenuItem>
          </DeleteVariableValueDialog>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
