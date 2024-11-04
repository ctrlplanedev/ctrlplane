"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

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
  Form,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

type CreateLifecycleHookDialogProps = {
  deploymentId: string;
  runbooks: SCHEMA.Runbook[];
  children: React.ReactNode;
};

const schema = z.object({ runbookId: z.string() });

export const CreateLifecycleHookDialog: React.FC<
  CreateLifecycleHookDialogProps
> = ({ deploymentId, runbooks, children }) => {
  const [open, setOpen] = useState(false);
  const createLifecycleHook = api.deployment.lifecycleHook.create.useMutation();
  const router = useRouter();
  const form = useForm({ schema });
  const onSubmit = form.handleSubmit((data) =>
    createLifecycleHook
      .mutateAsync({ deploymentId, ...data })
      .then(() => form.reset())
      .then(() => router.refresh())
      .then(() => setOpen(false)),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Lifecycle Hook</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="runbookId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Runbook</FormLabel>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a runbook" />
                    </SelectTrigger>
                    <SelectContent>
                      {runbooks.map((runbook) => (
                        <SelectItem key={runbook.id} value={runbook.id}>
                          {runbook.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
