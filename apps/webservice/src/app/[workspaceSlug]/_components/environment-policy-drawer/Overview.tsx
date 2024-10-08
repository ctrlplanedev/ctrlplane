import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
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

import { api } from "~/trpc/react";
import { useEnvironmentPolicyDrawer } from "./EnvironmentPolicyDrawer";

const DeleteEnvironmentPolicyDialog: React.FC<{
  environmentPolicy: schema.EnvironmentPolicy;
  children: React.ReactNode;
}> = ({ environmentPolicy, children }) => {
  const deleteEnvironmentPolicy = api.environment.policy.delete.useMutation();
  const utils = api.useUtils();
  const { removeEnvironmentPolicyId } = useEnvironmentPolicyDrawer();

  const onDelete = () =>
    deleteEnvironmentPolicy
      .mutateAsync(environmentPolicy.id)
      .then(removeEnvironmentPolicyId)
      .then(() =>
        utils.environment.policy.bySystemId.invalidate(
          environmentPolicy.systemId,
        ),
      );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Environment Policy</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this environment policy? You will have
          to recreate it from scratch.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className={buttonVariants({ variant: "destructive" })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const overviewForm = z.object({
  name: z.string(),
  description: z.string(),
});

export const Overview: React.FC<{
  environmentPolicy: schema.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const form = useForm({
    schema: overviewForm,
    defaultValues: {
      name: environmentPolicy.name,
      description: environmentPolicy.description ?? "",
    },
  });

  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();
  const onSubmit = form.handleSubmit((data) =>
    updatePolicy
      .mutateAsync({
        id: environmentPolicy.id,
        data,
      })
      .then(() => form.reset(data))
      .then(() =>
        utils.environment.policy.byId.invalidate(environmentPolicy.id),
      ),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 p-2">
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
                <Textarea placeholder="Add a description..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={updatePolicy.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
          <div className="flex-grow" />
          <DeleteEnvironmentPolicyDialog environmentPolicy={environmentPolicy}>
            <Button variant="destructive">Delete</Button>
          </DeleteEnvironmentPolicyDialog>
        </div>
      </form>
    </Form>
  );
};
