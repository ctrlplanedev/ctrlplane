"use client";

import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import React, { useState } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
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

type CreateRelationshipDialogProps = {
  workspaceId: string;
};

const formSchema = SCHEMA.createResourceRelationshipRule.extend({
  metadataKeysMatches: z.array(
    z.object({
      sourceKey: z.string(),
      targetKey: z.string(),
    }),
  ),
  targetMetadataEquals: z.array(
    z.object({ value: z.string(), key: z.string() }),
  ),
  sourceMetadataEquals: z.array(
    z.object({ value: z.string(), key: z.string() }),
  ),
});

const ReferenceField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="reference"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Reference</FormLabel>
        <FormControl>
          <Input {...field} placeholder="Enter a unique reference name" />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const NameField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
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
);

const DescriptionField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="description"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Description</FormLabel>
        <FormControl>
          <Textarea
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="Enter a description of this relationship rule"
            className="h-20 resize-none"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const DependencyDescriptionField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="dependencyDescription"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Dependency Description</FormLabel>
        <FormControl>
          <Textarea
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder="Describe how the source resource depends on the target resource"
            className="h-20 resize-none"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const DependencyTypeField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="dependencyType"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Dependency Type</FormLabel>
        <FormControl>
          <Input {...field} placeholder="depends on" />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const SourceResourceFields: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <div className="space-y-4 pt-4">
    <h4 className="text-sm font-medium leading-none">Source Resource</h4>
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
);

const TargetResourceFields: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium leading-none">Target Resource</h4>
    <div className="flex gap-4">
      <FormField
        control={form.control}
        name="targetKind"
        render={({ field: { value, onChange } }) => (
          <FormItem className="flex-1">
            <FormLabel className="text-xs text-muted-foreground">
              Resource Kind
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., Service"
                value={value ?? ""}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const value = inputValue.trim() === "" ? null : inputValue;
                  onChange(value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="targetVersion"
        render={({ field: { value, onChange } }) => (
          <FormItem className="flex-1">
            <FormLabel className="text-xs text-muted-foreground">
              Resource Version
            </FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., v1"
                value={value ?? ""}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  const value = inputValue.trim() === "" ? null : inputValue;
                  onChange(value);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  </div>
);

const MetadatakeysMatchField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
  field: FieldArrayWithId;
  index: number;
  onRemove: () => void;
}> = ({ form, field, index, onRemove }) => (
  <FormField
    key={field.id}
    control={form.control}
    name={`metadataKeysMatches.${index}`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-1 rounded-md border border-neutral-800 px-2 py-1">
            <Input
              value={field.value.sourceKey}
              onChange={(e) =>
                field.onChange({
                  ...field.value,
                  sourceKey: e.target.value,
                })
              }
              placeholder="Enter key..."
              className="h-6 w-32 border-0 ring-0 focus-visible:ring-0"
            />
            <span className="text-sm text-muted-foreground">matches</span>
            <Input
              value={field.value.targetKey}
              onChange={(e) =>
                field.onChange({ ...field.value, targetKey: e.target.value })
              }
              placeholder="Enter key..."
              className="h-6 w-32 border-0 ring-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-5 w-5"
            >
              <IconX className="h-3 w-3" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

const TargetMetadataEqualsField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
  field: FieldArrayWithId;
  index: number;
  onRemove: () => void;
}> = ({ form, field, index, onRemove }) => (
  <FormField
    key={field.id}
    control={form.control}
    name={`targetMetadataEquals.${index}`}
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-4 rounded-md border border-neutral-800 px-2 py-1">
            <Input
              value={value.key}
              onChange={(e) => onChange({ ...value, key: e.target.value })}
              placeholder="key"
              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
            />
            <span className="text-sm text-neutral-200">equals</span>
            <Input
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              placeholder="value"
              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-5 w-5"
            >
              <IconX className="h-3 w-3" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

const SourceMetadataEqualsField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
  field: FieldArrayWithId;
  index: number;
  onRemove: () => void;
}> = ({ form, field, index, onRemove }) => (
  <FormField
    key={field.id}
    control={form.control}
    name={`sourceMetadataEquals.${index}`}
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-4 rounded-md border border-neutral-800 px-2 py-1">
            <Input
              value={value.key}
              onChange={(e) => onChange({ ...value, key: e.target.value })}
              placeholder="key"
              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
            />
            <span className="text-sm text-neutral-200">equals</span>
            <Input
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              placeholder="value"
              className="h-6 w-40 border-neutral-800 ring-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-5 w-5"
            >
              <IconX className="h-3 w-3" />
            </Button>
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

export const CreateRelationshipDialog: React.FC<
  CreateRelationshipDialogProps
> = ({ workspaceId }) => {
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: formSchema,
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
      metadataKeysMatches: [],
      targetMetadataEquals: [],
      sourceMetadataEquals: [],
    },
  });

  const utils = api.useUtils();
  const createRule = api.resource.relationshipRules.create.useMutation();

  const onSubmit = form.handleSubmit((data) => {
    createRule
      .mutateAsync(data)
      .then(() => utils.resource.relationshipRules.list.invalidate())
      .then(() => setOpen(false));
  });

  const {
    fields: metadataKeysMatch,
    append: appendMetadataKeysMatch,
    remove: removeMetadataKeysMatch,
  } = useFieldArray({
    name: "metadataKeysMatches",
    control: form.control,
  });

  const {
    fields: targetMetadataEquals,
    append: appendTargetMetadataEquals,
    remove: removeTargetMetadataEquals,
  } = useFieldArray({
    name: "targetMetadataEquals",
    control: form.control,
  });

  const {
    fields: sourceMetadataEquals,
    append: appendSourceMetadataEquals,
    remove: removeSourceMetadataEquals,
  } = useFieldArray({
    name: "sourceMetadataEquals",
    control: form.control,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          Add Relationship Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Relationship Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ReferenceField form={form} />
            <NameField form={form} />
            <DescriptionField form={form} />
            <DependencyDescriptionField form={form} />
            <DependencyTypeField form={form} />
            <SourceResourceFields form={form} />
            <TargetResourceFields form={form} />

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Metadata Match Keys
              </h4>
              <div className="flex flex-wrap items-start gap-2">
                {metadataKeysMatch.map((field, index) => (
                  <MetadatakeysMatchField
                    key={field.id}
                    form={form}
                    field={field}
                    index={index}
                    onRemove={() => removeMetadataKeysMatch(index)}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendMetadataKeysMatch({ sourceKey: "", targetKey: "" })
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Target Metadata Equals
              </h4>
              <div className="flex flex-wrap items-start gap-2">
                {targetMetadataEquals.map((field, index) => (
                  <TargetMetadataEqualsField
                    key={field.id}
                    form={form}
                    field={field}
                    index={index}
                    onRemove={() => removeTargetMetadataEquals(index)}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendTargetMetadataEquals({ key: "", value: "" })
                  }
                >
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Source Metadata Equals
              </h4>
              <div className="flex flex-wrap items-start gap-2">
                {sourceMetadataEquals.map((field, index) => (
                  <SourceMetadataEqualsField
                    key={field.id}
                    form={form}
                    field={field}
                    index={index}
                    onRemove={() => removeSourceMetadataEquals(index)}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    appendSourceMetadataEquals({ key: "", value: "" })
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
