"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const systemForm = z.object({
  name: z.string().min(3).max(255),
  slug: z.string().min(3).max(255),
  description: z.string().default(""),
});

type SystemFormValues = z.infer<typeof systemForm>;

export const CreateSystemDialog: React.FC<{
  children: React.ReactNode;
  workspaceId: string;
}> = ({ children, workspaceId }) => {
  const [open, setOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const create = api.system.create.useMutation();
  const form = useForm<SystemFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
    },
  });

  const router = useRouter();
  const utils = api.useUtils();
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const system = await create.mutateAsync({ workspaceId, ...values });
      await utils.system.list.invalidate();
      router.push(`/${workspaceSlug}/systems/${system.slug}`);
    } catch (e) {
      console.error(e);
    }
    setOpen(false);
  });

  const { name } = form.watch();
  useEffect(
    () => form.setValue("slug", slugify(name, { lower: true })),
    [form, name],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New System</DialogTitle>
              <DialogDescription>
                Systems are a group of processes, releases, and runbooks for an
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
                    <Textarea placeholder="" {...field} />
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
