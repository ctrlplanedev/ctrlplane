"use client";

import React, { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ctrlplane/ui/dialog";
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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

interface CreateRelationshipDialogProps {
  workspaceId: string;
}

const dependencyType = [
  "depends_on",
  "depends_indirectly_on",
  "uses_at_runtime",
  "created_after",
  "provisioned_in",
  "inherits_from",
] as const;

const schema = z.object({
  reference: z
    .string()
    .min(1)
    .refine(
      (val) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(val) || // slug case
        /^[a-z][a-zA-Z0-9]*$/.test(val) || // camel case
        /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(val), // snake case
      {
        message:
          "Reference must be in slug case (my-reference), camel case (myReference), or snake case (my_reference)",
      },
    ),

  name: z.string().min(1),
  description: z.string().nullable(),
  dependencyDescription: z.string().nullable(),
  sourceKind: z.string(),
  sourceVersion: z.string(),
  targetKind: z.string(),
  targetVersion: z.string(),
  dependencyType: z.enum(dependencyType),
  metadataKeys: z.string().array().min(1),
});

export const CreateRelationshipDialog: React.FC<
  CreateRelationshipDialogProps
> = ({ workspaceId }) => {
  const [currentMetadataKey, setCurrentMetadataKey] = useState("");

  const form = useForm({
    schema,
    defaultValues: {
      reference: "",
      name: "",
      description: null,
      dependencyDescription: null,
      sourceKind: "",
      sourceVersion: "",
      targetKind: "",
      targetVersion: "",
      dependencyType: "depends_on",
      metadataKeys: [],
    },
  });

  const utils = api.useUtils();
  const createRule = api.resource.relationshipRules.create.useMutation({
    onSuccess: () => {
      utils.resource.relationshipRules.list.invalidate();
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          Add Relationship Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Relationship Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              createRule.mutateAsync({
                workspaceId,

                ...data,
              }),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter a unique reference name"
                    />
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
                      {...field}
                      placeholder="Enter a human-readable name"
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
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Enter a description of this relationship rule"
                      className="h-20 resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dependencyDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dependency Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Describe how the source resource depends on the target resource"
                      className="h-20 resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 pt-4">
              <h4 className="text-sm font-medium leading-none">
                Source Resource
              </h4>
              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="sourceKind"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">
                        Resource Kind
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Deployment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceVersion"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">
                        Resource Version
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., v1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="dependencyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Dependency Type
                  </FormLabel>
                  <FormControl>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start font-normal"
                        >
                          {capitalCase(field.value)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full min-w-[200px]">
                        {dependencyType.map((type) => (
                          <DropdownMenuItem
                            key={type}
                            onClick={() => field.onChange(type)}
                          >
                            {capitalCase(type)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Target Resource
              </h4>
              <div className="flex gap-4">
                <FormField
                  control={form.control}
                  name="targetKind"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">
                        Resource Kind
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Service" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetVersion"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-xs text-muted-foreground">
                        Resource Version
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., v1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Metadata Keys
              </h4>
              <FormField
                control={form.control}
                name="metadataKeys"
                render={({ field }) => {
                  const addKey = () => {
                    const value = currentMetadataKey.trim();
                    if (value && !field.value.includes(value)) {
                      field.onChange([...field.value, value]);
                      setCurrentMetadataKey("");
                    }
                  };

                  return (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-wrap items-start gap-2">
                          {field.value.map((key, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1"
                            >
                              <span>{key}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newKeys = [...field.value];
                                  newKeys.splice(index, 1);
                                  field.onChange(newKeys);
                                }}
                                className="ml-1 text-muted-foreground hover:text-foreground"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <div className="flex min-w-[200px] flex-1 items-center gap-2">
                            <Input
                              className="!mt-0 flex-1"
                              placeholder="Enter metadata key"
                              value={currentMetadataKey}
                              onChange={(e) =>
                                setCurrentMetadataKey(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addKey();
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={addKey}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <Button type="submit">Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
