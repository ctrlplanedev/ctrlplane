"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import slugify from "slugify";
import { z } from "zod";

import { deploymentSchema } from "@ctrlplane/db";
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

const deploymentForm = z.object(deploymentSchema.shape);

export const CreateDeploymentDialog: React.FC<{
  children?: React.ReactNode;
  defaultSystemId?: string;
  onSuccess?: () => void;
}> = ({ children, defaultSystemId = undefined, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const systems = api.system.list.useQuery(
    { workspaceId: workspace.data?.id ?? "" },
    { enabled: workspace.isSuccess },
  );
  const createDeployment = api.deployment.create.useMutation();
  const router = useRouter();

  const form = useForm({
    schema: deploymentForm,
    defaultValues: {
      systemId: defaultSystemId ?? systems.data?.items[0]?.id,
      name: "",
      slug: "",
      description: "",
    },
    mode: "onChange",
  });

  const { handleSubmit, watch, setValue, setError } = form;

  watch((data, { name: fieldName }) => {
    if (fieldName === "name")
      setValue("slug", slugify(data.name ?? "", { lower: true }), {
        shouldValidate: true,
      });
  });

  const onSubmit = handleSubmit(async (deployment) => {
    const systemSlug = systems.data?.items.find(
      (system) => system.id === deployment.systemId,
    )?.slug;
    await createDeployment
      .mutateAsync({ ...deployment })
      .then(() => {
        router.push(
          `/${workspaceSlug}/systems/${systemSlug}/deployments/${deployment.slug}`,
        );
        setOpen(false);
        onSuccess?.();
      })
      .catch(() => {
        setError("root", {
          message: "Deployment with this slug already exists",
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
                  <FormMessage />
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
            <FormRootError />
            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
