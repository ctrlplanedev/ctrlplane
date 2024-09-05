import { useState } from "react";
import { useParams } from "next/navigation";
import { TbX } from "react-icons/tb";

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
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { createGoogleSchema } from "./GoogleDialog";

export const UpdateGoogleProviderDialog: React.FC<{
  providerId: string;
  name: string;
  projectIds: string[];
  children: React.ReactNode;
}> = ({ providerId, name, projectIds, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const form = useForm({
    schema: createGoogleSchema,
    defaultValues: { name, projectIds: projectIds.map((p) => ({ value: p })) },
    mode: "onChange",
  });

  const utils = api.useUtils();
  const update = api.target.provider.managed.google.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({
      ...data,
      targetProviderId: providerId,
      config: { projectIds: data.projectIds.map((p) => p.value) },
    });
    await utils.target.provider.byWorkspaceId.invalidate();
    setOpen(false);
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "projectIds",
  });

  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) form.reset();
      }}
    >
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
                        <div className="flex items-center gap-2">
                          <Input placeholder="my-gcp-project-id" {...field} />

                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => remove(index)}
                            >
                              <TbX className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                Update
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
