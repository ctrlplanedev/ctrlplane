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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const deploymentForm = z.object({
  name: z.string().min(3).max(255),
  slug: z.string().min(3).max(255),
  systemId: z.string().uuid(),
  description: z.string().default(""),
});

type DeploymentFormValues = z.infer<typeof deploymentForm>;

export const CreateDeploymentDialog: React.FC<{
  defaultSystemId?: string;
  children?: React.ReactNode;
}> = ({ children, defaultSystemId = "" }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const create = api.deployment.create.useMutation();
  const form = useForm<DeploymentFormValues>({
    defaultValues: {
      systemId: defaultSystemId,
      name: "",
      slug: "",
      description: "",
    },
  });

  const { systemId, name } = form.watch();
  useEffect(
    () => form.setValue("slug", slugify(name, { lower: true })),
    [form, name],
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (defaultSystemId === "") return;
    window.requestAnimationFrame(() => {
      form.setFocus("name");
    });
  }, [open, form, defaultSystemId]);

  const systems = api.system.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess },
  );
  useEffect(() => {
    if (defaultSystemId !== "") return;
    if (systemId !== "") return;
    const firstSystem = systems.data?.items.at(0);
    if (firstSystem == null) return;
    form.setValue("systemId", firstSystem.id);
  }, [defaultSystemId, form, systems, systemId]);

  const router = useRouter();
  const utils = api.useUtils();
  const onSubmit = form.handleSubmit(async (data) => {
    const deployment = await create.mutateAsync(data);
    await utils.deployment.invalidate();
    const slug = systems.data?.items.find(
      (system) => system.id === deployment.systemId,
    )?.slug;
    if (slug == null) return;
    router.push(
      `/${workspaceSlug}/systems/${slug}/deployments/${deployment.slug}`,
    );
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New Deployment</DialogTitle>
              <DialogDescription>
                Deploy can be a application, services, or infrastructure. It
                executes pipelines to create instances of the system.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="systemId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>System</FormLabel>
                  <FormControl>
                    <Select value={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {systems.data?.items.map((system) => (
                            <SelectItem key={system.id} value={system.id}>
                              {system.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
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
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
