"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as SCHEMA from "@ctrlplane/db/schema";
import type { HookAction } from "@ctrlplane/validators/events";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconSelector } from "@tabler/icons-react";
import { z } from "zod";

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  hookActions,
  hookActionsList,
  RunhookVariables,
} from "@ctrlplane/validators/events";

import { JobAgentConfig } from "~/components/form/job-agent/JobAgentConfig";
import { JobAgentSelector } from "~/components/form/job-agent/JobAgentSelector";
import { api } from "~/trpc/react";

type Hook = RouterOutputs["deployment"]["hook"]["list"][number];
type EditHookDialogProps = {
  hook: Hook;
  jobAgents: SCHEMA.JobAgent[];
  workspace: SCHEMA.Workspace;
  children: React.ReactNode;
  onClose: () => void;
};

const schema = z.object({
  name: z.string().min(1),
  action: hookActions,
  jobAgentId: z.string().nullable(),
  jobAgentConfig: z.record(z.any()).nullable(),
});

export const EditHookDialog: React.FC<EditHookDialogProps> = ({
  hook,
  jobAgents,
  workspace,
  children,
  onClose,
}) => {
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const updateHook = api.deployment.hook.update.useMutation();
  const utils = api.useUtils();
  const router = useRouter();

  const defaultValues = {
    ...hook,
    jobAgentId: hook.runhook?.runbook.jobAgentId ?? null,
    jobAgentConfig: hook.runhook?.runbook.jobAgentConfig ?? null,
  };
  const form = useForm({ schema, defaultValues });
  const onSubmit = form.handleSubmit(async (data) => {
    const variables = RunhookVariables[data.action as HookAction];
    const jobAgentId =
      data.jobAgentId === "" || data.jobAgentId == null
        ? undefined
        : data.jobAgentId;
    const jobAgentConfig = data.jobAgentConfig ?? undefined;
    await updateHook
      .mutateAsync({
        id: hook.id,
        data: { ...data, variables, jobAgentId, jobAgentConfig },
      })
      .then(() => utils.deployment.hook.list.invalidate(hook.scopeId))
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .then(() => onClose());
  });

  const { jobAgentId } = form.watch();
  const jobAgent = jobAgents.find((j) => j.id === jobAgentId);

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

            <DialogHeader>
              <DialogTitle>Attach Runbook</DialogTitle>
              <DialogDescription>
                This runbook will trigger when the hook is triggered.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="jobAgentId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Job Agent</FormLabel>
                  <FormControl>
                    <JobAgentSelector
                      jobAgents={jobAgents}
                      workspace={workspace}
                      value={value ?? undefined}
                      onChange={onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="jobAgentConfig"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Config</FormLabel>
                  <FormControl>
                    <JobAgentConfig
                      workspace={workspace}
                      jobAgent={jobAgent}
                      value={value ?? {}}
                      onChange={onChange}
                      githubFormStyleConfig={{
                        className: "flex flex-col gap-2 items-center w-[450px]",
                        buttonWidth: "w-[450px]",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.setValue("jobAgentId", null);
                  form.setValue("jobAgentConfig", {});
                }}
              >
                Remove Runbook
              </Button>
              <div className="flex-grow" />
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
