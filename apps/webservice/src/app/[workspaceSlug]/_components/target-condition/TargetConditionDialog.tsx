import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
import type { UseFormReturn } from "react-hook-form";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";
import {
  defaultCondition,
  isDefaultCondition,
  isValidTargetCondition,
  isValidTargetViewCondition,
  MAX_DEPTH_ALLOWED,
  targetCondition,
} from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { TargetConditionRender } from "./TargetConditionRender";

type TargetConditionDialogProps = {
  condition?: TargetCondition;
  onChange: (condition: TargetCondition | undefined) => void;
  children: React.ReactNode;
};

export const TargetConditionDialog: React.FC<TargetConditionDialogProps> = ({
  condition,
  onChange,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCondition, setLocalCondition] = useState(
    condition ?? defaultCondition,
  );

  // there is some weirdness with the sidebar environment panel,
  // where the condition doesn't update properly. this useEffect
  // guarantees that the local condition is always in sync with the
  // condition prop.
  useEffect(() => {
    setLocalCondition(condition ?? defaultCondition);
  }, [condition]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Target Filter</DialogTitle>
          <DialogDescription>
            Edit the target filter for this environment, up to a depth of{" "}
            {MAX_DEPTH_ALLOWED + 1}.
          </DialogDescription>
        </DialogHeader>
        <TargetConditionRender
          condition={localCondition}
          onChange={setLocalCondition}
        />
        {error && <span className="text-sm text-red-600">{error}</span>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setLocalCondition(defaultCondition);
              setError(null);
            }}
          >
            Clear
          </Button>
          <div className="flex-grow" />
          <Button
            onClick={() => {
              if (!isValidTargetCondition(localCondition)) {
                setError(
                  "Invalid target condition, ensure all fields are filled out correctly.",
                );
                return;
              }
              onChange(
                isDefaultCondition(localCondition) ? undefined : localCondition,
              );
              setOpen(false);
              setError(null);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const targetViewFormSchema = z.object({
  name: z.string().min(1),
  filter: targetCondition.refine((data) => isValidTargetViewCondition(data), {
    message: "Invalid target condition",
  }),
  description: z.string().optional(),
});

const TargetViewForm: React.FC<{
  form: UseFormReturn<z.infer<typeof targetViewFormSchema>>;
  onSubmit: (data: z.infer<typeof targetViewFormSchema>) => void;
}> = ({ form, onSubmit }) => (
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
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
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="filter"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <FormLabel>Filter</FormLabel>
            <FormControl>
              <TargetConditionRender condition={value} onChange={onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => form.setValue("filter", defaultCondition)}
        >
          Clear
        </Button>
        <div className="flex-grow" />
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  </Form>
);

type CreateTargetViewDialogProps = {
  workspaceId: string;
  filter?: TargetCondition;
  onSubmit?: (view: schema.TargetView) => void;
  children: React.ReactNode;
};

export const CreateTargetViewDialog: React.FC<CreateTargetViewDialogProps> = ({
  workspaceId,
  filter,
  onSubmit,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: targetViewFormSchema,
    defaultValues: {
      name: "",
      description: "",
      filter: filter ?? defaultCondition,
    },
  });
  const router = useRouter();

  const createTargetView = api.target.view.create.useMutation();

  const onFormSubmit = (data: z.infer<typeof targetViewFormSchema>) => {
    createTargetView
      .mutateAsync({
        ...data,
        workspaceId,
      })
      .then((view) => onSubmit?.(view))
      .then(() => form.reset())
      .then(() => setOpen(false))
      .then(() => router.refresh());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Create Target View</DialogTitle>
          <DialogDescription>
            Create a target view for this workspace.
          </DialogDescription>
        </DialogHeader>
        <TargetViewForm form={form} onSubmit={onFormSubmit} />
      </DialogContent>
    </Dialog>
  );
};

type EditTargetViewDialogProps = {
  view: schema.TargetView;
  onClose?: () => void;
  onSubmit?: (view: schema.TargetView) => void;
  children: React.ReactNode;
};

export const EditTargetViewDialog: React.FC<EditTargetViewDialogProps> = ({
  view,
  onClose,
  onSubmit,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: targetViewFormSchema,
    defaultValues: {
      name: view.name,
      description: view.description ?? "",
      filter: view.filter,
    },
  });
  const router = useRouter();

  const updateTargetView = api.target.view.update.useMutation();

  const onFormSubmit = (data: z.infer<typeof targetViewFormSchema>) => {
    updateTargetView
      .mutateAsync({
        id: view.id,
        data,
      })
      .then((view) => onSubmit?.(view))
      .then(() => setOpen(false))
      .then(onClose)
      .then(() => router.refresh());
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open) onClose?.();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Create Target View</DialogTitle>
          <DialogDescription>
            Create a target view for this workspace.
          </DialogDescription>
        </DialogHeader>
        <TargetViewForm form={form} onSubmit={onFormSubmit} />
      </DialogContent>
    </Dialog>
  );
};
