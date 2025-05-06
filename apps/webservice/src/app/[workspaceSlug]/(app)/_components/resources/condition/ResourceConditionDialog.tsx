"use client";

import type * as schema from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

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
import { useForm } from "@ctrlplane/ui/form";
import {
  defaultCondition,
  isValidResourceCondition,
  MAX_DEPTH_ALLOWED,
} from "@ctrlplane/validators/resources";

import type { ResourceViewFormSchema } from "./ResourceViewForm";
import { api } from "~/trpc/react";
import { ResourceConditionRender } from "./ResourceConditionRender";
import { ResourceViewForm, resourceViewFormSchema } from "./ResourceViewForm";

type ResourceConditionDialogProps = {
  condition: ResourceCondition | null;
  onChange: (condition: ResourceCondition | null) => void;
  children: React.ReactNode;
  ResourceList?: React.FC<{ filter: ResourceCondition }>;
};

export const ResourceConditionDialog: React.FC<
  ResourceConditionDialogProps
> = ({ condition, onChange, children, ResourceList }) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cond = condition ?? defaultCondition;
  const [localCondition, setLocalCondition] = useState(cond);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="min-w-[1000px]"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Resource Filter</DialogTitle>
          <DialogDescription>
            Edit the resource filter for this environment, up to a depth of{" "}
            {MAX_DEPTH_ALLOWED + 1}.
          </DialogDescription>
        </DialogHeader>
        <ResourceConditionRender
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
              if (!isValidResourceCondition(localCondition)) {
                setError(
                  "Invalid resource condition, ensure all fields are filled out correctly.",
                );
                return;
              }
              onChange(localCondition);
              setOpen(false);
              setError(null);
            }}
          >
            Save
          </Button>
        </DialogFooter>
        {ResourceList != null && <ResourceList filter={localCondition} />}
      </DialogContent>
    </Dialog>
  );
};

type CreateResourceViewDialogProps = {
  workspaceId: string;
  filter: ResourceCondition | null;
  onSubmit?: (view: schema.ResourceView) => void;
  children: React.ReactNode;
};

export const CreateResourceViewDialog: React.FC<
  CreateResourceViewDialogProps
> = ({ workspaceId, filter, onSubmit, children }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: resourceViewFormSchema,
    defaultValues: {
      name: "",
      description: "",
      filter: filter ?? defaultCondition,
    },
  });
  const router = useRouter();

  const createResourceView = api.resource.view.create.useMutation();

  const onFormSubmit = (data: ResourceViewFormSchema) => {
    createResourceView
      .mutateAsync({ ...data, workspaceId })
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
          <DialogTitle>Create Resource View</DialogTitle>
          <DialogDescription>
            Create a resource view for this workspace.
          </DialogDescription>
        </DialogHeader>
        <ResourceViewForm form={form} onSubmit={onFormSubmit} />
      </DialogContent>
    </Dialog>
  );
};

type EditResourceViewDialogProps = {
  view: schema.ResourceView;
  onClose?: () => void;
  onSubmit?: (view: schema.ResourceView) => void;
  children: React.ReactNode;
};

export const EditResourceViewDialog: React.FC<EditResourceViewDialogProps> = ({
  view,
  onClose,
  onSubmit,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: resourceViewFormSchema,
    defaultValues: { ...view, description: view.description ?? "" },
  });
  const router = useRouter();

  const updateResourceView = api.resource.view.update.useMutation();

  const onFormSubmit = (data: ResourceViewFormSchema) => {
    updateResourceView
      .mutateAsync({ id: view.id, data })
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
          <DialogTitle>Edit Resource View</DialogTitle>
          <DialogDescription>
            Edit a resource view for this workspace.
          </DialogDescription>
        </DialogHeader>
        <ResourceViewForm form={form} onSubmit={onFormSubmit} />
      </DialogContent>
    </Dialog>
  );
};
