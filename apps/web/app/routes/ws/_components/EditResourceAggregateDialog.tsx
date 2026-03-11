import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";

const editAggregateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  filter: z.string().optional(),
  groupBy: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      property: z.string().min(1, "Property is required"),
    }),
  ),
});

type EditAggregateFormData = z.infer<typeof editAggregateSchema>;

type EditResourceAggregateDialogProps = {
  aggregate: {
    id: string;
    name: string;
    description: string | null;
    filter: string;
    groupBy: Array<{ name: string; property: string }> | null;
  };
  children?: ReactNode;
  onSuccess?: () => void;
};

export function EditResourceAggregateDialog({
  aggregate,
  children,
  onSuccess,
}: EditResourceAggregateDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const form = useForm<EditAggregateFormData>({
    resolver: zodResolver(editAggregateSchema),
    defaultValues: {
      name: aggregate.name,
      description: aggregate.description ?? "",
      filter: aggregate.filter === "true" ? "" : aggregate.filter,
      groupBy: aggregate.groupBy ?? [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: aggregate.name,
        description: aggregate.description ?? "",
        filter: aggregate.filter === "true" ? "" : aggregate.filter,
        groupBy: aggregate.groupBy ?? [],
      });
    }
  }, [open, aggregate, form]);

  const {
    fields: groupByFields,
    append: appendGroupBy,
    remove: removeGroupBy,
  } = useFieldArray({
    control: form.control,
    name: "groupBy",
  });

  const updateMutation = trpc.resourceAggregates.update.useMutation({
    onSuccess: () => {
      toast.success("Aggregate updated successfully");
      setOpen(false);
      void utils.resourceAggregates.get.invalidate();
      void utils.resourceAggregates.list.invalidate();
      void utils.resourceAggregates.evaluate.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update aggregate");
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await updateMutation.mutateAsync({
      workspaceId: workspace.id,
      id: aggregate.id,
      name: data.name,
      description: data.description || null,
      filter: data.filter || undefined,
      groupBy: data.groupBy.length > 0 ? data.groupBy : null,
    });
  });

  const isSubmitting = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button variant="outline">Edit</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Resource Aggregate</DialogTitle>
          <DialogDescription>
            Update the filter and grouping for this aggregate.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Production Servers by Region"
                      {...field}
                      disabled={isSubmitting}
                      autoFocus
                    />
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
                    <Textarea
                      placeholder="Optional description..."
                      className="resize-none"
                      rows={2}
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="filter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filter (CEL)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="resource.kind == 'server'"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    CEL expression to filter resources. Defaults to all
                    resources.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Group By</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendGroupBy({ name: "", property: "" })}
                  disabled={isSubmitting}
                >
                  <PlusIcon className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {groupByFields.length > 0 && (
                <div className="space-y-2">
                  {groupByFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <FormField
                        control={form.control}
                        name={`groupBy.${index}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="Label"
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`groupBy.${index}.property`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="resource.metadata['region']"
                                {...field}
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGroupBy(index)}
                        disabled={isSubmitting}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <FormDescription>
                Properties to group resources by (e.g. resource.metadata['region'],
                resource.kind)
              </FormDescription>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
