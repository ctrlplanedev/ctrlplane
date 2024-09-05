"use client";

import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
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
  FormMessage,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";

export const createGoogleSchema = z.object({
  name: z.string(),
  projectIds: z.array(z.object({ value: z.string() })),
});

type CreateGoogleConfig = z.infer<typeof createGoogleSchema>;

export const GoogleDialog: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const form = useForm<CreateGoogleConfig>({
    resolver: zodResolver(createGoogleSchema),
    defaultValues: { projectIds: [{ value: "" }] },
    mode: "onChange",
  });
  const { fields, append } = useFieldArray({
    name: "projectIds",
    control: form.control,
  });

  const router = useRouter();
  const utils = api.useUtils();
  const create = api.target.provider.managed.google.create.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await create.mutateAsync({
      ...data,
      workspaceId: workspace.data.id,
      config: { projectIds: data.projectIds.map((p) => p.value) },
    });
    await utils.target.provider.byWorkspaceId.invalidate();
    router.push(`/${workspaceSlug}/target-providers`);
  });
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Configure Google Provider</DialogTitle>
              <DialogDescription>
                Google provider allows you to configure and import GKE clusters
                from google.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              {fields.map((field, index) => (
                <FormField
                  control={form.control}
                  key={field.id}
                  name={`projectIds.${index}.value`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={cn(index !== 0 && "sr-only")}>
                        Google Projects
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="my-gcp-project-id" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ value: "" })}
              >
                Add Project
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
