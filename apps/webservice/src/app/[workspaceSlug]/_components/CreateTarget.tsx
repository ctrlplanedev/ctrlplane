"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import type React from "react";
import { useEffect, useState } from "react";
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

import { api } from "~/trpc/react";
import { ConfigEditor } from "./ConfigEditor";

const createTargetSchema = z.object({
  name: z.string(),
  kind: z.string(),
  identifier: z.string().min(4),
  version: z.string(),
  config: z.string().refine((val) => {
    try {
      const output = yaml.load(val);
      const isValidRecord = z.record(z.any()).safeParse(output).success;
      return isValidRecord;
    } catch {
      return false;
    }
  }, "Config must be valid YAML Object"),
  metadata: z.array(z.object({ key: z.string(), value: z.string() })),
});

const defaultValues = {
  name: "",
  identifier: "",
  kind: "",
  version: "",
  metadata: [{ key: "", value: "" }],
  config: "",
};

export const CreateTargetDialog: React.FC<{
  children: React.ReactNode;
  workspace: Workspace;
  onSuccess?: () => void;
}> = ({ children, workspace, onSuccess }) => {
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: createTargetSchema,
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!open) form.reset();
  }, [form, open]);

  const router = useRouter();
  const create = api.target.create.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    const config = yaml.load(data.config) as Record<string, any>;
    const target = await create.mutateAsync({
      ...data,
      config,
      metadata: Object.fromEntries(
        data.metadata.map(({ key, value }) => [key, value]),
      ),
      workspaceId: workspace.id,
    });

    const query = new URLSearchParams(window.location.search);
    query.set("target_id", target.id);
    router.replace(`?${query.toString()}`);
    router.refresh();
    onSuccess?.();
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
              <DialogTitle>Bootstrap Target</DialogTitle>
              <DialogDescription>
                Targets are typically created automatically through scanners
                that discover and register new targets in your infrastructure.
                However, you can manually bootstrap a target if needed.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my-target" {...field} />
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
                    <Input placeholder="mycompany-my-target" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Version</FormLabel>
                    <FormControl>
                      <Input placeholder="mycompany/v1" {...field} />
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
                      <Input placeholder="MyCustomTarget" {...field} />
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
                            onChange={(e) =>
                              onChange({ ...value, key: `${e.target.value}` })
                            }
                          />
                          <Input
                            value={value.value}
                            onChange={(e) =>
                              onChange({ ...value, value: `${e.target.value}` })
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => remove(index)}
                          >
                            <IconX />
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
                className="mt-4"
                onClick={() => append({ key: "", value: "" })}
              >
                Add Metadata
              </Button>
            </div>

            <FormRootError />
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create Target
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
