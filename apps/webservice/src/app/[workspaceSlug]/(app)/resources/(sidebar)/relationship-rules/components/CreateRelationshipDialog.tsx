"use client";

import React, { useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";
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
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

interface CreateRelationshipDialogProps {
  workspaceId: string;
}

export const CreateRelationshipDialog: React.FC<
  CreateRelationshipDialogProps
> = ({ workspaceId }) => {
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: SCHEMA.createResourceRelationshipRule.extend({
      metadataKeysMatch: z.array(z.object({ key: z.string() })),
    }),
    defaultValues: {
      workspaceId,
      reference: "",
      name: "",
      description: null,
      dependencyDescription: null,
      sourceKind: "",
      sourceVersion: "",
      targetKind: null,
      targetVersion: null,
      dependencyType: "depends_on",
      metadataKeysMatch: [],
      metadataKeysEquals: [],
    },
  });

  const utils = api.useUtils();
  const createRule = api.resource.relationshipRules.create.useMutation();

  const onSubmit = form.handleSubmit((data) => {
    const { metadataKeysMatch } = data;
    const matchKeys = metadataKeysMatch.map((item) => item.key);

    createRule
      .mutateAsync({ ...data, metadataKeysMatch: matchKeys })
      .then(() => utils.resource.relationshipRules.list.invalidate())
      .then(() => setOpen(false));
  });

  const {
    fields: metadataKeysMatch,
    append: appendMetadataKeysMatch,
    remove: removeMetadataKeysMatch,
  } = useFieldArray({
    name: "metadataKeysMatch",
    control: form.control,
  });

  const {
    fields: metadataKeysEquals,
    append: appendMetadataKeysEquals,
    remove: removeMetadataKeysEquals,
  } = useFieldArray({
    name: "metadataKeysEquals",
    control: form.control,
  });

  const formError = form.formState.errors;
  console.log({ formError });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <form onSubmit={onSubmit} className="space-y-4">
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
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      value={value ?? ""}
                      onChange={onChange}
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
                        {Object.values(SCHEMA.ResourceDependencyType).map(
                          (type) => (
                            <DropdownMenuItem
                              key={type}
                              onClick={() => field.onChange(type)}
                            >
                              {capitalCase(type)}
                            </DropdownMenuItem>
                          ),
                        )}
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
                        <Input
                          {...field}
                          placeholder="e.g., Service"
                          value={field.value ?? ""}
                        />
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
                        <Input
                          {...field}
                          placeholder="e.g., v1"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Metadata Match Keys
              </h4>
              <div className="flex flex-wrap items-start gap-2">
                {metadataKeysMatch.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`metadataKeysMatch.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1">
                            <Input
                              value={field.value.key}
                              onChange={(e) =>
                                field.onChange({ key: e.target.value })
                              }
                              placeholder="Enter key..."
                              className="h-6 w-32 border-0 ring-0 focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMetadataKeysMatch(index)}
                              className="h-5 w-5"
                            >
                              <IconX className="h-3 w-3" />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendMetadataKeysMatch({ key: "" })}
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Metadata Equals Keys
              </h4>
              <div className="flex flex-wrap items-start gap-2">
                {metadataKeysEquals.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`metadataKeysEquals.${index}`}
                    render={({ field: { value, onChange } }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center gap-4 rounded-md border border-neutral-800 px-2 py-1">
                            <Input
                              value={value.key}
                              onChange={(e) =>
                                onChange({ ...value, key: e.target.value })
                              }
                              placeholder="key"
                              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
                            />
                            <span className="text-sm text-neutral-200">
                              equals
                            </span>
                            <Input
                              value={value.value}
                              onChange={(e) =>
                                onChange({ ...value, value: e.target.value })
                              }
                              placeholder="value"
                              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMetadataKeysEquals(index)}
                              className="h-5 w-5"
                            >
                              <IconX className="h-3 w-3" />
                            </Button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendMetadataKeysEquals({ key: "", value: "" })
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            <Button type="submit">Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
