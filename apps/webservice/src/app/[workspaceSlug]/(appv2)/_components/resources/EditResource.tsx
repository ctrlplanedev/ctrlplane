"use client";

import type { Resource } from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import yaml from "js-yaml";
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
  FormRootError,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { ConfigEditor } from "~/app/[workspaceSlug]/(appv2)/_components/ConfigEditor";
import { api } from "~/trpc/react";

type ResourceWithMetadata = Resource & {
  metadata: Record<string, string>;
};

const editResourceSchema = z.object({
  name: z.string(),
  kind: z.string(),
  identifier: z.string().min(4),
  version: z.string(),
  config: z.string().refine(
    (val) => {
      try {
        const output = yaml.load(val);
        const isValidRecord = z.record(z.any()).safeParse(output).success;
        return isValidRecord;
      } catch {
        return false;
      }
    },
    { message: "Config must be a valid YAML Object" },
  ),
  metadata: z
    .array(
      z.object({
        key: z.string().min(1, "Key is required"),
        value: z.string().min(1, "Value is required"),
      }),
    )
    .refine(
      (arr) => {
        const keys = arr.map((item) => item.key);
        return keys.length === new Set(keys).size;
      },
      { message: "Metadata keys must be unique" },
    ),
});

const defaultValues = (resource: ResourceWithMetadata) => ({
  ...resource,
  config: yaml.dump(resource.config),
  metadata: Object.entries(resource.metadata).map(([key, value]) => ({
    key,
    value,
  })),
});

export const EditResourceDialog: React.FC<{
  children: React.ReactNode;
  resource: ResourceWithMetadata;
  onSuccess?: () => void;
}> = ({ children, resource, onSuccess }) => {
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: editResourceSchema,
    defaultValues: defaultValues(resource),
    mode: "onSubmit",
  });

  const router = useRouter();
  const update = api.resource.update.useMutation();

  const onSubmit = form.handleSubmit((data) => {
    const config = yaml.load(data.config) as Record<string, any>;
    const metadata = Object.fromEntries(
      data.metadata.map(({ key, value }) => [key, value]),
    );
    update
      .mutateAsync({
        id: resource.id,
        data: { ...data, config, metadata },
      })
      .then(() => {
        router.refresh();
        onSuccess?.();
        setOpen(false);
      })
      .catch(() => {
        form.setError("root", {
          message: "Failed to update resource. Please check your input.",
        });
      });
  });

  const { fields, append, remove } = useFieldArray({
    name: "metadata",
    control: form.control,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Edit Resource</DialogTitle>
              <DialogDescription>
                You can edit the resource details below. Fields marked as
                optional may not be required.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Resource Name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifier</FormLabel>
                  <FormControl>
                    <Input placeholder="mycompany-my-resource" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="Version" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kind</FormLabel>
                      <FormControl>
                        <Input placeholder="Kind" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="config"
                render={({ field: { onChange, value } }) => (
                  <FormItem>
                    <FormLabel>Config</FormLabel>
                    <FormControl>
                      <ConfigEditor value={value} onChange={onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <div className="pb-2">
                  <Label>Metadata</Label>
                </div>
                {fields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`metadata.${index}`}
                    render={({ field: { onChange, value } }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center gap-4">
                            <Input
                              value={value.key}
                              placeholder="Key"
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  key: e.target.value,
                                })
                              }
                            />
                            <Input
                              value={value.value}
                              placeholder="Value"
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  value: e.target.value,
                                })
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(index)}
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ key: "", value: "" })}
                  className="mt-4"
                >
                  Add Metadata
                </Button>
              </div>
            </>

            <FormRootError />

            <DialogFooter>
              <Button type="submit" disabled={update.isPending}>
                Update Resource
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
