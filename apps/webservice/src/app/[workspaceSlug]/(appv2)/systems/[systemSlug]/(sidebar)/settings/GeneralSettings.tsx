"use client";

import React from "react";

import * as schema from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

export const GeneralSettings: React.FC<{ system: schema.System }> = ({
  system,
}) => {
  const form = useForm({
    schema: schema.updateSystem,
    defaultValues: system,
  });
  const updateSystem = api.system.update.useMutation();
  const utils = api.useUtils();

  const onFormSubmit = form.handleSubmit((data) =>
    updateSystem
      .mutateAsync({
        id: system.id,
        data,
      })
      .then(() => {
        utils.system.list.invalidate({
          workspaceId: system.workspaceId,
        });
      })
      .catch(() => {
        form.setError("root", {
          message: "System with this slug already exists",
        });
      }),
  );
  return (
    <Form {...form}>
      <form onSubmit={onFormSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>ID</Label>
          <Input value={system.id} disabled />
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} />
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
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormRootError />

        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};
