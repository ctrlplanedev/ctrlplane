import type { ReactNode } from "react";
import { useState } from "react";
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

const createAggregateSchema = z.object({
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

type CreateAggregateFormData = z.infer<typeof createAggregateSchema>;

type CreateResourceAggregateDialogProps = {
  children?: ReactNode;
  onSuccess?: () => void;
};

export function CreateResourceAggregateDialog({
  children,
  onSuccess,
}: CreateResourceAggregateDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const form = useForm<CreateAggregateFormData>({
    resolver: zodResolver(createAggregateSchema),
    defaultValues: {
      name: "",
      description: "",
      filter: "",
      groupBy: [],
    },
  });

  const {
    fields: groupByFields,
    append: appendGroupBy,
    remove: removeGroupBy,
  } = useFieldArray({
    control: form.control,
    name: "groupBy",
  });

  const createMutation = trpc.resourceAggregates.create.useMutation({
    onSuccess: () => {
      toast.success("Aggregate created successfully");
      setOpen(false);
      form.reset();
      void utils.resourceAggregates.list.invalidate();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create aggregate");
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await createMutation.mutateAsync({
      workspaceId: workspace.id,
      name: data.name,
      description: data.description || undefined,
      filter: data.filter || undefined,
      groupBy: data.groupBy.length > 0 ? data.groupBy : undefined,
    });
  });

  const isSubmitting = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>Create Aggregate</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Resource Aggregate</DialogTitle>
          <DialogDescription>
            Define a filter and grouping to aggregate resources for tables,
            charts, and views.
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
                                placeholder="metadata.region"
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
                Properties to group resources by (e.g. metadata.region,
                kind)
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
                Create Aggregate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
