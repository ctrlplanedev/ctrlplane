"use client";

import React from "react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DialogFooter } from "@ctrlplane/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
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

import { api } from "~/trpc/react";

export const referenceFormSchema = (existingKeys: string[]) =>
  z.object({
    key: z
      .string()
      .refine((k) => k.length > 0, { message: "Key is required" })
      .refine((k) => !existingKeys.includes(k), {
        message: "Variable key must be unique",
      }),
    reference: z.string().refine((r) => r.length > 0, {
      message: "Reference is required",
    }),
    path: z
      .string()
      .array()
      .refine((p) => p.length > 0, {
        message: "Path is required",
      }),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  });

export type ReferenceVariableFormProps = {
  references: string[];
  resourceId: string;
  existingKeys: string[];
  onSuccess: () => void;
};

export const ReferenceVariableForm: React.FC<ReferenceVariableFormProps> = ({
  resourceId,
  existingKeys,
  onSuccess,
  references,
}) => {
  const createResourceVariable =
    api.resource.variable.createReference.useMutation();
  const utils = api.useUtils();

  const form = useForm({
    schema: referenceFormSchema(existingKeys),
    defaultValues: {
      key: "",
      reference: "",
      path: [],
      defaultValue: undefined,
    },
  });

  const onSubmit = form.handleSubmit((data) =>
    createResourceVariable
      .mutateAsync({
        resourceId,
        key: data.key,
        reference: data.reference,
        path: data.path,
        defaultValue: data.defaultValue === "" ? undefined : data.defaultValue,
        valueType: "reference",
      })
      .then(() => utils.resource.byId.invalidate(resourceId))
      .then(() => form.reset())
      .then(onSuccess),
  );

  return (
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
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference</FormLabel>
              <FormControl>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {field.value || "Select reference..."}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full">
                    {references.map((reference) => (
                      <DropdownMenuItem
                        key={reference}
                        onClick={() => field.onChange(reference)}
                      >
                        {reference}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="path"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Path</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {field.value.map((tag, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = [...field.value];
                          newTags.splice(index, 1);
                          field.onChange(newTags);
                        }}
                        className="ml-1 text-muted-foreground hover:text-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Input
                    className="!mt-0 flex-1"
                    placeholder="Type and press Enter to add path segment"
                    onChange={(e) => {
                      if (e.target.value.endsWith("\n")) {
                        e.preventDefault();
                        const value = e.target.value.trim();
                        if (value) {
                          field.onChange([...field.value, value]);
                          e.target.value = "";
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const value = e.currentTarget.value.trim();
                        if (value) {
                          field.onChange([...field.value, value]);
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="defaultValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default Value (Optional)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value === undefined ? "" : String(field.value)}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    field.onChange(value === "" ? undefined : value);
                  }}
                  placeholder="Fallback if reference is not available"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={createResourceVariable.isPending}>
            Create
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};
