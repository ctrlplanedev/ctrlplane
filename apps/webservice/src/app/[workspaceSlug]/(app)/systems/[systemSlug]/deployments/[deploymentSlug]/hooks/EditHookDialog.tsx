"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconSelector, IconX } from "@tabler/icons-react";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { hookActions, hookActionsList } from "@ctrlplane/validators/events";

import { api } from "~/trpc/react";

type Hook = RouterOutputs["deployment"]["hook"]["list"][number];
type EditHookDialogProps = {
  hook: Hook;
  runbooks: SCHEMA.Runbook[];
  children: React.ReactNode;
  onClose: () => void;
};

const schema = z.object({
  name: z.string().min(1),
  action: hookActions,
  runbookIds: z.array(z.object({ id: z.string().uuid() })),
});

export const EditHookDialog: React.FC<EditHookDialogProps> = ({
  hook,
  runbooks,
  children,
  onClose,
}) => {
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [runbooksOpen, setRunbooksOpen] = useState(false);
  const updateHook = api.deployment.hook.update.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const defaultValues = {
    ...hook,
    runbookIds: hook.runhooks.map((rh) => ({ id: rh.runbookId })),
  };
  const form = useForm({ schema, defaultValues });
  const onSubmit = form.handleSubmit((data) =>
    updateHook
      .mutateAsync({
        id: hook.id,
        data: { ...data, runbookIds: data.runbookIds.map((r) => r.id) },
      })
      .then(() => utils.deployment.hook.list.invalidate(hook.scopeId))
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .then(() => onClose()),
  );

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "runbookIds",
  });

  const selectedRunbookIds = form.watch("runbookIds").map((r) => r.id);

  const unselectedRunbooks = runbooks.filter(
    (r) => !selectedRunbookIds.includes(r.id),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>Edit Hook</DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="action"
              render={({ field: { onChange, value } }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>Action</FormLabel>
                  <FormControl>
                    <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={actionsOpen}
                          className="items-center justify-start gap-2 px-2"
                        >
                          <IconSelector className="h-4 w-4" />
                          {value === "" ? "Select action..." : value}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[462px] p-0">
                        <Command>
                          <CommandInput placeholder="Search action..." />
                          <CommandList>
                            {hookActionsList.map((action) => (
                              <CommandItem
                                key={action}
                                value={action}
                                onSelect={() => {
                                  onChange(action);
                                  setActionsOpen(false);
                                }}
                              >
                                {action}
                              </CommandItem>
                            ))}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <Label>Runbooks</Label>
              <div className="flex flex-wrap gap-2">
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`runbookIds.${index}.id`}
                    render={({ field }) => {
                      const runbook = runbooks.find(
                        (r) => r.id === field.value,
                      );
                      return (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          {runbook?.name ?? ""}
                          <IconX
                            className="h-4 w-4 cursor-pointer"
                            onClick={() => remove(index)}
                          />
                        </Badge>
                      );
                    }}
                  />
                ))}
              </div>
            </div>

            <Popover open={runbooksOpen} onOpenChange={setRunbooksOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <IconPlus className="h-4 w-4" />
                  Add Runbook
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Command>
                  <CommandInput placeholder="Search runbook..." />
                  <CommandList>
                    {unselectedRunbooks.map((runbook) => (
                      <CommandItem
                        key={runbook.id}
                        onSelect={() => {
                          append({ id: runbook.id });
                          setRunbooksOpen(false);
                        }}
                      >
                        {runbook.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <DialogFooter>
              <Button
                type="submit"
                disabled={updateHook.isPending || !form.formState.isDirty}
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
