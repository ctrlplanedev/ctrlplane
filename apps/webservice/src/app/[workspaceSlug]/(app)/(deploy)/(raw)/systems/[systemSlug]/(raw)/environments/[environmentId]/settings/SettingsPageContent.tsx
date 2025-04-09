"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { directoryPath } from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
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

const name = z.string().min(1).max(100);
const description = z.string().max(1000).nullable();
const schema = z.object({ name, description, directory: directoryPath });

export const SettingsPageContent: React.FC<{
  environment: SCHEMA.Environment;
}> = ({ environment }) => {
  const defaultValues = { ...environment };
  const form = useForm({ schema, defaultValues });
  const update = api.environment.update.useMutation();

  const utils = api.useUtils();
  const router = useRouter();
  const { id, systemId } = environment;
  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({ id, data })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(systemId))
      .then(() => utils.environment.byId.invalidate(id))
      .then(() => router.refresh()),
  );

  return (
    <div className="space-y-8">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Environment Settings</CardTitle>
          <CardDescription>
            Configure the environment settings for the environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Staging, Production, QA..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a description..."
                        value={value ?? ""}
                        onChange={onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="directory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Directory</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="my/env/path"
                        className="font-mono"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={update.isPending || !form.formState.isDirty}
              >
                Save
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
