import type * as schema from "@ctrlplane/db/schema";
import type { TargetCondition } from "@ctrlplane/validators/targets";
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
  isValidTargetCondition,
  MAX_DEPTH_ALLOWED,
} from "@ctrlplane/validators/targets";

import type { TargetViewFormSchema } from "./TargetViewForm";
import { api } from "~/trpc/react";
import { TargetConditionRender } from "./TargetConditionRender";
import { TargetViewForm, targetViewFormSchema } from "./TargetViewForm";

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
              onChange(localCondition);
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

type CreateTargetViewDialogProps = {
  workspaceId: string;
  filter?: TargetCondition;
  onSubmit?: (view: schema.ResourceView) => void;
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

  const onFormSubmit = (data: TargetViewFormSchema) => {
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
  view: schema.ResourceView;
  onClose?: () => void;
  onSubmit?: (view: schema.ResourceView) => void;
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

  const onFormSubmit = (data: TargetViewFormSchema) => {
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
