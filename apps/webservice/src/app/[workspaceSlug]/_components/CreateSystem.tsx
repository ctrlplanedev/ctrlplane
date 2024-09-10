"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import slugify from "slugify";
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
  FormMessage,
  FormRootMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { safeFormAwait } from "~/utils/error/safeAwait";

const systemForm = z.object({
  name: z
    .string()
    .min(3, { message: "System name must be at least 3 characters long." })
    .max(30, { message: "System Name must be at most 30 characters long." }),
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

export const CreateSystemDialog: React.FC<{
  children: React.ReactNode;
  workspaceId: string;
  workspaceSlug: string;
}> = ({ children, workspaceId, workspaceSlug }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const create = api.system.create.useMutation({});
  const form = useForm({
    disabled: create.isPending,
    schema: systemForm,
    defaultValues: { name: "", slug: "", description: "" },
  });

  const { name } = form.watch();
  useEffect(
    () => form.setValue("slug", slugify(name, { lower: true })),
    [form, name],
  );

  const onSubmit = form.handleSubmit(async (data) => {
    const [system, error] = await safeFormAwait(
      create.mutateAsync({ ...data, workspaceId }),
      form,
      { entityName: "system" },
    );
    if (error != null) return;
    router.push(`/${workspaceSlug}/systems/${system.slug}`);
    setOpen(false);
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
                  <FormLabel>System Name</FormLabel>
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
                  <FormLabel>System Slug</FormLabel>
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
            <FormRootMessage />
            <DialogFooter>
              <Button
                type="submit"
                disabled={create.isPending}
                className="mt-4 w-full"
              >
                Create system
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
