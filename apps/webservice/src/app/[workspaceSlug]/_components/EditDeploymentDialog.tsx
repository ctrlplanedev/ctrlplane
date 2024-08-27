"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
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

const _deploymentForm = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(255),
  slug: z.string().min(3).max(255),
  description: z.string().optional(),
});

type DeploymentFormValues = z.infer<typeof _deploymentForm>;

export const EditDeploymentDialog: React.FC<{
  deploymentId: string;
  deploymentName: string;
  deploymentSlug: string;
  deploymentDescription: string;
  children?: React.ReactNode;
}> = ({
  deploymentId,
  deploymentName,
  deploymentSlug,
  deploymentDescription,
  children,
}) => {
  const router = useRouter(); // Initialize the router
  const update = api.deployment.update.useMutation();
  const [open, setOpen] = useState(false);

  const form = useForm<DeploymentFormValues>({
    defaultValues: {
      id: deploymentId,
      name: deploymentName,
      slug: deploymentSlug,
      description: deploymentDescription,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const isDataChanged =
      data.name !== deploymentName ||
      data.slug !== deploymentSlug ||
      data.description !== deploymentDescription;

    setOpen(false);
    if (!isDataChanged) {
      return;
    }
    const updatedDeployment = await update.mutateAsync({
      id: deploymentId,
      data,
    });

    router.push(`./deployments/${updatedDeployment.slug}`);
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
              name="id"
              render={() => (
                <FormItem>
                  <FormLabel>ID</FormLabel>
                  <div className="flex items-center space-x-2">
                    <FormControl>
                      <Input
                        value={deploymentId}
                        readOnly
                        className="!cursor-not-allowed bg-gray-800 text-gray-100"
                      />
                    </FormControl>
                    <CopyButton textToCopy={deploymentId} />
                  </div>
                </FormItem>
              )}
            />
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
                      className="!focus:cursor-auto"
                      autoFocus
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
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
