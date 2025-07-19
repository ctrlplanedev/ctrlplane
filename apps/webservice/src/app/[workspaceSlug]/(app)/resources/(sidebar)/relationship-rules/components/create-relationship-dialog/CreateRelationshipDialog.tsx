"use client";

import React, { useState } from "react";
import { IconPlus } from "@tabler/icons-react";

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

import type { RuleForm } from "./formSchema";
import { api } from "~/trpc/react";
import { CopyJsonButton, CopyYamlButton } from "./CopyButtons";
import { formSchema } from "./formSchema";
import { MetadatakeysMatchField } from "./MetadataKeysMatchField";
import { SourceMetadataEqualsField } from "./SourceMetadataEqualsField";
import { SourceResourceFields } from "./SourceResourceFields";
import { TargetMetadataEqualsField } from "./TargetMetadataEqualsField";
import { TargetResourceFields } from "./TargetResourceFields";

type CreateRelationshipDialogProps = {
  workspaceId: string;
};

const ReferenceField: React.FC<{
  form: RuleForm;
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
  form: RuleForm;
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
  form: RuleForm;
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
  form: RuleForm;
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
  form: RuleForm;
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
      dependencyType: "depends on",
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
            <SourceResourceFields form={form} workspaceId={workspaceId} />
            <TargetResourceFields form={form} workspaceId={workspaceId} />

            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">
                Metadata Match Keys
              </h4>
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
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
              <div className="flex items-center gap-2">
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

            <div className="mt-4 flex w-full justify-between">
              <Button type="submit">Create</Button>
              <div className="flex items-center gap-2">
                <CopyYamlButton form={form} />
                <CopyJsonButton form={form} />
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
