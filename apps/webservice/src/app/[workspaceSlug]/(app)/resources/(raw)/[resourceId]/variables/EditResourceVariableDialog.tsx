"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { Checkbox } from "@ctrlplane/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

type EditResourceVariableDialogProps = {
  resourceVariable: SCHEMA.DirectResourceVariable;
  existingKeys: string[];
  children: React.ReactNode;
  onClose: () => void;
};

export const EditResourceVariableDialog: React.FC<
  EditResourceVariableDialogProps
> = ({ resourceVariable, existingKeys, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const updateResourceVariable = api.resource.variable.update.useMutation();
  const utils = api.useUtils();
  const keysWithoutCurrent = existingKeys.filter(
    (k) => k !== resourceVariable.key,
  );
  const schema = z.object({
    key: z
      .string()
      .refine((k) => k.length > 0, { message: "Key is required" })
      .refine((k) => !keysWithoutCurrent.includes(k), {
        message: "Variable key must be unique",
      }),
    type: z.enum(["string", "number", "boolean"]),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .refine((v) => (typeof v === "string" ? v.length > 0 : true), {
        message: "Value is required",
      }),
    sensitive: z.boolean(),
  });

  const defaultValues = {
    key: resourceVariable.key,
    type: typeof resourceVariable.value,
    value: resourceVariable.value,
    sensitive: resourceVariable.sensitive,
  };
  const form = useForm({ schema, defaultValues });

  const onSubmit = form.handleSubmit((data) =>
    updateResourceVariable
      .mutateAsync({ id: resourceVariable.id, data })
      .then(() => form.reset(data))
      .then(() => utils.resource.byId.invalidate(resourceVariable.resourceId))
      .then(() => router.refresh())
      .then(() => setOpen(false)),
  );

  const { sensitive, type } = form.watch();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Resource Variable</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field: { value, onChange } }) => {
                const onTypeChange = (type: string) => {
                  if (type === "string") form.setValue("value", "");
                  if (type === "number") form.setValue("value", 0);
                  if (type === "boolean") form.setValue("value", false);
                  if (type !== "string") form.setValue("sensitive", false);
                  onChange(type);
                };

                return (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <Select value={value} onValueChange={onTypeChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Variable type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {type === "string" && (
              <FormField
                control={form.control}
                name="value"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input
                        value={value as string}
                        onChange={onChange}
                        type={sensitive ? "password" : "text"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {type === "number" && (
              <FormField
                control={form.control}
                name="value"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Input
                        value={value as number}
                        onChange={onChange}
                        type="number"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            {type === "boolean" && (
              <FormField
                control={form.control}
                name="value"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <Select
                        value={value ? "true" : "false"}
                        onValueChange={(v) => onChange(v === "true")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Value..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">True</SelectItem>
                          <SelectItem value="false">False</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="sensitive"
              render={({ field: { value, onChange } }) => {
                const onSensitiveChange = (checked: boolean) => {
                  if (!checked) form.setValue("value", "");
                  onChange(checked);
                };
                return (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={value}
                          onCheckedChange={onSensitiveChange}
                        />
                        <label htmlFor="sensitive" className="text-sm">
                          Sensitive
                        </label>
                      </div>
                    </FormControl>
                  </FormItem>
                );
              }}
            />

            <DialogFooter>
              <Button type="submit" disabled={updateResourceVariable.isPending}>
                Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
