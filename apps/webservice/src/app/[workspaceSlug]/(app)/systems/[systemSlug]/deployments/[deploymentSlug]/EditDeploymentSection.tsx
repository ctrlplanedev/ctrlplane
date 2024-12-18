"use client";

import { useParams, useRouter } from "next/navigation";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const deploymentForm = z.object(schema.deploymentSchema.shape);

type EditDeploymentSectionProps = {
  deployment: schema.Deployment;
  systems: schema.System[];
};

export const EditDeploymentSection: React.FC<EditDeploymentSectionProps> = ({
  deployment,
  systems,
}) => {
  const form = useForm({
    schema: deploymentForm,
    defaultValues: { ...deployment },
    mode: "onSubmit",
  });
  const { handleSubmit, setError } = form;

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const updateDeployment = api.deployment.update.useMutation();
  const onSubmit = handleSubmit((data) => {
    updateDeployment
      .mutateAsync({ id: deployment.id, data })
      .then((updatedDeployment) => {
        if (
          data.slug !== deployment.slug ||
          updatedDeployment.systemId !== deployment.systemId
        )
          router.replace(
            `/${workspaceSlug}/systems/${updatedDeployment.system.slug}/deployments/${data.slug}`,
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
            name="systemId"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>System</FormLabel>
                <FormControl>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a system" />
                    </SelectTrigger>
                    <SelectContent>
                      {systems.map((system) => (
                        <SelectItem key={system.id} value={system.id}>
                          {system.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="retryCount"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>Retry Count</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.valueAsNumber)}
                    min={0}
                    step={1}
                    className="w-16"
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
