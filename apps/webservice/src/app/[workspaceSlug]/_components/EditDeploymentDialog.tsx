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
  FormMessage,
  FormRootMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { safeFormAwait } from "~/utils/error/safeAwait";

const deploymentFormSchema = z.object({
  systemId: z.string().uuid({ message: "Invalid system ID format." }),
  id: z.string().uuid({ message: "Invalid ID format." }),
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters long." })
    .max(255, { message: "Name must be at most 255 characters long." }),
  slug: z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long." })
    .max(255, { message: "Slug must be at most 255 characters long." }),
  description: z
    .string()
    .max(255, { message: "Description must be at most 255 characters long." })
    .optional()
    .refine((val) => !val || val.length >= 3, {
      message: "Description must be at least 3 characters long if provided.",
    }),
});

type DeploymentFormValues = z.infer<typeof deploymentFormSchema>;

export const EditDeploymentDialog: React.FC<
  DeploymentFormValues & { children?: React.ReactNode }
> = ({ systemId, id, name, slug, description, children }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(deploymentFormSchema),
    defaultValues: { systemId, id, name, slug, description },
    mode: "onChange",
  });

  const update = api.deployment.update.useMutation({
    onSuccess: () => {
      router.refresh();
      setOpen(false);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const isDataChanged = !isEqual(data, { name, slug, description });
    if (!isDataChanged) {
      setOpen(false);
      return;
    }

    await safeFormAwait(update.mutateAsync({ id, data }), form, {
      entityName: "deployment",
    });
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
                  <FormMessage />
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
                  <FormMessage />
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
                  <FormMessage />
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
            <FormRootMessage />
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
