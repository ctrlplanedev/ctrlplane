"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import slugify from "slugify";
import { z } from "zod";

import { systemSchema } from "@ctrlplane/db/schema";
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
  FormMessage,
  FormRootError,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const systemForm = z.object(systemSchema.shape);

export const CreateSystemDialog: React.FC<{
  children: React.ReactNode;
  workspace: Workspace;
  onSuccess?: () => void;
}> = ({ children, workspace, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const createSystem = api.system.create.useMutation();
  const router = useRouter();

  const form = useForm({
    schema: systemForm,
    defaultValues: { name: "", slug: "", description: "" },
    mode: "onChange",
  });

  const { handleSubmit, watch, setValue, setError } = form;

  watch((data, { name: fieldName }) => {
    if (fieldName === "name")
      setValue("slug", slugify(data.name ?? "", { lower: true }), {
        shouldValidate: true,
      });
  });

  const onSubmit = handleSubmit(async (system) => {
    const systemSlug = system.slug;
    await createSystem
      .mutateAsync({ workspaceId: workspace.id, ...system })
      .then(() => {
        router.push(`/${workspace.slug}/systems/${systemSlug}`);
        router.refresh();
        setOpen(false);
        onSuccess?.();
      })
      .catch(() => {
        setError("root", {
          message: "System with this slug already exists",
        });
      });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New System</DialogTitle>
              <DialogDescription>
                Systems are a group of processes, releases, and runbooks for
                applications or services.
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
                      placeholder="Identity Services, Payment Services..."
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
                    <Input
                      placeholder="identity-services, payment-services..."
                      {...field}
                    />
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
                    <Textarea
                      placeholder="Describe your system..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormRootError />
            <DialogFooter>
              <Button type="submit" disabled={createSystem.isPending}>
                Create system
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
