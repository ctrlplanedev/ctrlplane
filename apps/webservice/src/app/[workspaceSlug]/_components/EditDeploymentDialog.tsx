"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import isEqual from "lodash/isEqual";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { CopyButton } from "@ctrlplane/ui/copy-button";
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
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const deploymentForm = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(255),
  slug: z.string().min(3).max(255),
  description: z.string().optional(),
});

type DeploymentFormValues = z.infer<typeof deploymentForm>;

export const EditDeploymentDialog: React.FC<
  DeploymentFormValues & { children?: React.ReactNode }
> = ({ id, name, slug, description, children }) => {
  const router = useRouter();
  const update = api.deployment.update.useMutation();
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(deploymentForm),
    defaultValues: { id, name, slug, description },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const isDataChanged = !isEqual(data, { name, slug, description });

    setOpen(false);
    if (!isDataChanged) return;

    await update.mutateAsync({
      id: id,
      data,
    });

    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Edit Deployment</DialogTitle>
              <DialogDescription>
                Edit the details of your deployment.
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
                      placeholder="Website, Identity Service..."
                      {...field}
                    />
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
                    <Textarea {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="id"
              render={() => (
                <FormItem>
                  <FormLabel>ID</FormLabel>
                  <Input
                    value={id}
                    readOnly
                    className="bg-gray-800 text-gray-100"
                  />
                </FormItem>
              )}
            />
            <DialogFooter>
              <CopyButton textToCopy={id} />
              <div className="flex-grow" />
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
