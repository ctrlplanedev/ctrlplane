"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

const updateWorkspace = z.object({
  name: z.string(),
  slug: z.string(),
});

export const WorkspaceUpdateSection: React.FC = () => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const form = useForm({
    schema: updateWorkspace,
    defaultValues: { name: "", slug: "" },
  });

  useEffect(() => {
    const { data } = workspace;
    if (data == null) return;
    if (form.getValues("name") !== "") return;
    form.setValue("name", data.name);
    form.setValue("slug", data.slug);
  }, [form, workspace]);

  const router = useRouter();
  const update = api.workspace.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({ id: workspace.data.id, data });
    router.push(`/${data.slug}/settings/workspace/general`);
    router.refresh();
  });
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} className="max-w-[250px]" />
              </FormControl>
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
                <Input {...field} className="max-w-[250px]" />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit">Update</Button>
      </form>
    </Form>
  );
};
