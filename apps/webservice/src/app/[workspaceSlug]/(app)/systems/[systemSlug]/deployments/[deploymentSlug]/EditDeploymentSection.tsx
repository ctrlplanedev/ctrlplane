"use client";

import type { Deployment } from "@ctrlplane/db/schema";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";

import { deploymentSchema } from "@ctrlplane/db/schema";
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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const deploymentForm = z.object(deploymentSchema.shape);

export const EditDeploymentSection: React.FC<{
  deployment: Deployment;
}> = ({ deployment }) => {
  const form = useForm({
    schema: deploymentForm,
    defaultValues: { ...deployment },
    mode: "onSubmit",
  });
  const { handleSubmit, setError } = form;

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();
  const router = useRouter();
  const updateDeployment = api.deployment.update.useMutation();
  const onSubmit = handleSubmit((data) => {
    updateDeployment
      .mutateAsync({ id: deployment.id, data })
      .then(() => {
        if (data.slug !== deployment.slug)
          router.replace(
            `/${workspaceSlug}/systems/${systemSlug}/deployments/${data.slug}`,
          );
        router.refresh();
      })
      .catch(() => {
        setError("root", {
          message: "Deployment with this slug already exists",
        });
      });
  });
  return (
    <div className="container m-8 mx-auto max-w-3xl space-y-2">
      <h2 className="" id="properties">
        Properties
      </h2>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-2">
          <FormField
            control={form.control}
            name="id"
            render={() => (
              <FormItem>
                <FormLabel>ID</FormLabel>
                <Input value={deployment.id} disabled />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Website, Identity Service..."
                    {...field}
                  />
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

          <FormField
            control={form.control}
            name="retryCount"
            render={({ field: { value, onChange } }) => (
              <FormItem className="w-16">
                <FormLabel>Retry Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.valueAsNumber)}
                    min={0}
                    step={1}
                  />
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
    </div>
  );
};
