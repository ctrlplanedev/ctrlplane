"use client";

import type { UseFormReturn } from "react-hook-form";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IconInfoCircle } from "@tabler/icons-react";
import { z } from "zod";

import * as schema from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@ctrlplane/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";
import { defaultCondition } from "@ctrlplane/validators/resources";

import { ResourceConditionRender } from "~/app/[workspaceSlug]/(app)/_components/resources/condition/ResourceConditionRender";
import { api } from "~/trpc/react";
import {
  VariableBooleanInput,
  VariableChoiceSelect,
  VariableStringInput,
} from "../VariableInputs";

const formSchema = schema.createDirectDeploymentVariableValue.extend({
  isDefault: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});

const ValueFormField: React.FC<{
  variable: schema.DeploymentVariable;
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ variable, form }) => (
  <FormField
    control={form.control}
    name="value"
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormLabel>Value</FormLabel>
        <FormControl>
          <>
            {variable.config?.type === "string" && (
              <VariableStringInput
                {...variable.config}
                value={String(value)}
                onChange={onChange}
              />
            )}
            {variable.config?.type === "choice" && (
              <VariableChoiceSelect
                {...variable.config}
                value={String(value)}
                onSelect={onChange}
              />
            )}
            {variable.config?.type === "boolean" && (
              <VariableBooleanInput
                value={value === "" ? null : Boolean(value)}
                onChange={onChange}
              />
            )}
            {variable.config?.type === "number" && (
              <Input
                type="number"
                value={Number(value)}
                onChange={(e) => onChange(e.target.valueAsNumber)}
              />
            )}
          </>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const DefaultValueFormField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="isDefault"
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-4">
            <FormLabel className="flex items-center gap-1">
              Default
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="text-muted-foreground">
                    A default value will match all resources in the system that
                    are not matched by other values.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormLabel>
            <Switch checked={value} onCheckedChange={onChange} />
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

const SensitiveFormField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="sensitive"
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-4">
            <FormLabel className="flex items-center gap-1">
              Sensitive
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="text-muted-foreground">
                    A sensitive value will be stored in the database in an
                    encrypted form.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormLabel>
            <Switch checked={value} onCheckedChange={onChange} />
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

const PriorityFormField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="priority"
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormControl>
          <div className="flex items-center gap-4">
            <FormLabel className="flex items-center gap-1">
              Priority
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="text-muted-foreground">
                    Higher numbers take precedence when multiple values select
                    the same resource.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormLabel>
            <Input
              type="number"
              value={value}
              onChange={(e) =>
                onChange(
                  Number.isNaN(e.target.valueAsNumber)
                    ? undefined
                    : e.target.valueAsNumber,
                )
              }
              className="w-16"
            />
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

const ResourceSelectorFormField: React.FC<{
  form: UseFormReturn<z.infer<typeof formSchema>>;
}> = ({ form }) => (
  <FormField
    control={form.control}
    name="resourceSelector"
    render={({ field: { value, onChange } }) => (
      <FormItem>
        <FormLabel>Resource Selector</FormLabel>
        <FormControl>
          <div className="rounded-md border border-border p-4">
            <ResourceConditionRender
              condition={value ?? defaultCondition}
              onChange={onChange}
            />
          </div>
        </FormControl>
      </FormItem>
    )}
  />
);

export const CreateDirectValueDialog: React.FC<{
  variable: schema.DeploymentVariable;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ variable, onClose, children }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: formSchema,
    defaultValues: {
      isDefault: false,
      sensitive: false,
      value: null,
    },
  });
  const router = useRouter();

  const createDirectMutation =
    api.deployment.variable.value.direct.create.useMutation();

  const onSubmit = form.handleSubmit((data) =>
    createDirectMutation
      .mutateAsync({ variableId: variable.id, data })
      .then(() => router.refresh())
      .then(() => setOpen(false))
      .then(() => onClose()),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="min-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Create Direct Value</DialogTitle>
          <DialogDescription>
            Create a new direct value for the variable.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <ValueFormField variable={variable} form={form} />
            <DefaultValueFormField form={form} />
            <SensitiveFormField form={form} />
            <PriorityFormField form={form} />
            <ResourceSelectorFormField form={form} />

            <Button type="submit" disabled={createDirectMutation.isPending}>
              Create
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
