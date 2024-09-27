import React, { useState } from "react";

import * as schema from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

type SystemActionsDropdownProps = {
  system: schema.System;
  children: React.ReactNode;
};

const EditSystemDialog: React.FC<{
  system: schema.System;
  children: React.ReactNode;
  onSubmit?: () => void;
}> = ({ system, children, onSubmit }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: schema.updateSystem,
    defaultValues: {
      name: system.name,
      slug: system.slug,
      description: system.description,
    },
  });

  const updateSystem = api.system.update.useMutation();
  const utils = api.useUtils();
  const onFormSubmit = form.handleSubmit((data) =>
    updateSystem
      .mutateAsync({
        id: system.id,
        data,
      })
      .then(() => {
        utils.system.list.invalidate({
          workspaceId: system.workspaceId,
        });
        onSubmit?.();
        setOpen(false);
      }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Edit System</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onFormSubmit} className="space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export const SystemActionsDropdown: React.FC<SystemActionsDropdownProps> = ({
  system,
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <EditSystemDialog system={system} onSubmit={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            Edit System
          </DropdownMenuItem>
        </EditSystemDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
