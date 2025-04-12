"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
});

export const CreateEnvironmentDialog: React.FC<{
  systemId: string;
  children: React.ReactNode;
}> = ({ systemId, children }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();
  const create = api.environment.create.useMutation();
  const router = useRouter();
  const utils = api.useUtils();

  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: environmentForm,
    defaultValues: { name: "", description: "" },
  });

  const envUrl = urls.workspace(workspaceSlug).system(systemSlug).environment;

  const onSubmit = form.handleSubmit((data) =>
    create
      .mutateAsync({ ...data, systemId })
      .then(({ id }) => router.push(envUrl(id).resources()))
      .then(() => utils.environment.bySystemIdWithSearch.invalidate())
      .then(() => router.refresh())
      .then(() => setOpen(false)),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Add Environments</DialogTitle>
              <DialogDescription>
                Group your deployments by environment. Environments can be used
                to group resources.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Staging, Production, QA..."
                      {...field}
                    />
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
                    <Textarea placeholder="Add a description..." {...field} />
                  </FormControl>
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
