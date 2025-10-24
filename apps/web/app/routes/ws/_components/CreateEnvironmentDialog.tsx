import type { ReactNode } from "react";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";
import CelExpressionInput from "./CelExpiressionInput";

// Validation schema for environment creation
const createEnvironmentSchema = z.object({
  systemId: z.string().uuid({ message: "Valid system ID is required" }),
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be at most 255 characters long" }),
  description: z
    .string()
    .max(500, { message: "Description must be at most 500 characters long" })
    .optional(),
  celExpression: z.string().default("true"),
});

type CreateEnvironmentFormData = z.infer<typeof createEnvironmentSchema>;

type CreateEnvironmentDialogProps = {
  children?: ReactNode;
  systemId?: string;
  onSuccess?: (environment: { id: string; name: string }) => void;
};

export function CreateEnvironmentDialog({
  children,
  systemId,
  onSuccess,
}: CreateEnvironmentDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  // Fetch systems for the workspace
  const { data: systemsData, isLoading: systemsLoading } =
    trpc.system.list.useQuery({ workspaceId: workspace.id });

  const form = useForm<CreateEnvironmentFormData>({
    resolver: zodResolver(createEnvironmentSchema),
    defaultValues: {
      systemId: systemId ?? "00000000-0000-0000-0000-000000000000",
      name: "",
      description: "",
    },
  });

  const createEnvironmentMutation = trpc.environment.create.useMutation({
    onSuccess: (environment) => {
      toast.success("Environment created successfully");
      setOpen(false);
      form.reset();

      // Invalidate environments list to refetch
      void utils.environment.list.invalidate();

      onSuccess?.({
        id: environment.id,
        name: environment.name,
      });
    },
    onError: (error) => {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to create environment";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const workspaceId = workspace.id;
    await createEnvironmentMutation.mutateAsync({
      workspaceId,
      ...data,
      resourceSelectorCel: data.celExpression,
    });
  });

  const isSubmitting = createEnvironmentMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>Create Environment</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>
            Create a new environment to organize and manage your deployments
            across different stages like development, staging, and production.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {!systemId && (
              <FormField
                control={form.control}
                name="systemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || systemsLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a system" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {systemsData?.items.map(
                          (system: { id: string; name: string }) => (
                            <SelectItem key={system.id} value={system.id}>
                              {system.name}
                            </SelectItem>
                          ),
                        ) ?? []}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The system this environment belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Production, Staging, Development..."
                      {...field}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your environment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of this environment..."
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional information about this environment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="celExpression"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition</FormLabel>
                  <FormControl>
                    <div className="rounded-md border border-input p-2">
                      <CelExpressionInput
                        height="100px"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="resource.kind == 'KubernetesClusters'"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                Create Environment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
