import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil, IconTrash } from "@tabler/icons-react";

import * as schema from "@ctrlplane/db/schema";
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
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Switch } from "@ctrlplane/ui/switch";
import { defaultCondition } from "@ctrlplane/validators/resources";

import type { VariableValue } from "./variable-data";
import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import { api } from "~/trpc/react";
import {
  VariableBooleanInput,
  VariableChoiceSelect,
  VariableStringInput,
} from "./VariableInputs";

const EditVariableValueDialog: React.FC<{
  value: VariableValue;
  variable: schema.DeploymentVariable;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ value, variable, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const update = api.deployment.variable.value.update.useMutation();
  const router = useRouter();

  const form = useForm({
    schema: schema.updateDeploymentVariableValue,
    defaultValues: {
      ...value,
      default: variable.defaultValueId === value.id,
      valueType: value.valueType as "direct" | "reference",
    },
  });

  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({ id: value.id, data })
      .then(() => router.refresh())
      .then(onClose),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Edit variable value</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <FormField
              control={form.control}
              name="value"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <>
                      {variable.config?.type === "string" && (
                        <VariableStringInput
                          {...variable.config}
                          value={String(value)}
                          onChange={onChange}
                        />
                      )}
                      {variable.config?.type === "choice" && (
                        <VariableChoiceSelect
                          {...variable.config}
                          value={String(value)}
                          onSelect={onChange}
                        />
                      )}
                      {variable.config?.type === "boolean" && (
                        <VariableBooleanInput
                          value={value === "" ? null : Boolean(value)}
                          onChange={onChange}
                        />
                      )}
                      {variable.config?.type === "number" && (
                        <Input
                          type="number"
                          value={Number(value)}
                          onChange={(e) => onChange(e.target.valueAsNumber)}
                        />
                      )}
                    </>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="resourceSelector"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Resource selector</FormLabel>
                  <FormControl>
                    <ResourceConditionRender
                      condition={value ?? defaultCondition}
                      onChange={onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormLabel>Default</FormLabel>
                    <FormControl>
                      <Switch checked={value} onCheckedChange={onChange} />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => form.setValue("resourceSelector", null)}
              >
                Clear selector
              </Button>
              <div className="flex-grow" />
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

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
  variable: schema.DeploymentVariable;
  children: React.ReactNode;
}> = ({ value, variable, children }) => {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <EditVariableValueDialog
            value={value}
            variable={variable}
            onClose={() => setOpen(false)}
          >
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <IconPencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </EditVariableValueDialog>
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
