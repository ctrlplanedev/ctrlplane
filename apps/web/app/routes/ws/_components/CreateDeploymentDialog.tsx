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

// Validation schema for deployment creation
const createDeploymentSchema = z.object({
  systemId: z.string().min(2, { message: "System ID is required" }),
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters long" })
    .max(255, { message: "Name must be at most 255 characters long" }),
  slug: z
    .string()
    .min(3, { message: "Slug must be at least 3 characters long" })
    .max(255, { message: "Slug must be at most 255 characters long" })
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    }),
  description: z
    .string()
    .max(255, { message: "Description must be at most 255 characters long" })
    .optional(),
});

type CreateDeploymentFormData = z.infer<typeof createDeploymentSchema>;

type CreateDeploymentDialogProps = {
  children?: ReactNode;
  systemId?: string;
  onSuccess?: (deployment: { id: string; slug: string }) => void;
};

export function CreateDeploymentDialog({
  children,
  systemId,
  onSuccess,
}: CreateDeploymentDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  // Fetch systems for the workspace
  const { data: systemsData, isLoading: systemsLoading } =
    trpc.system.list.useQuery({ workspaceId: workspace.id });

  const form = useForm<CreateDeploymentFormData>({
    resolver: zodResolver(createDeploymentSchema),
    defaultValues: {
      systemId: systemId ?? "00000000-0000-0000-0000-000000000000",
      name: "",
      slug: "",
      description: "",
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate slug from name (convert to lowercase, replace spaces/special chars with hyphens)
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!form.formState.dirtyFields.slug) {
      form.setValue("slug", autoSlug);
    }
  };

  const createDeploymentMutation = trpc.deployment.create.useMutation({
    onSuccess: async (deployment) => {
      toast.success("Deployment created successfully");
      setOpen(false);
      form.reset();

      // Invalidate deployments list to refetch
      await utils.deployment.list.invalidate();

      onSuccess?.({
        id: deployment.id,
        slug: deployment.slug,
      });
    },
    onError: (error) => {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to create deployment";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const workspaceId = workspace.id;
      await createDeploymentMutation.mutateAsync({ workspaceId, ...data });
    } catch (err: unknown) {
      // Error is handled by the mutation's onError callback
      console.error("Failed to create deployment:", err);
    }
  });

  const isSubmitting = createDeploymentMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>Create Deployment</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Deployment</DialogTitle>
          <DialogDescription>
            Create a new deployment to manage releases of your application,
            service, or infrastructure.
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
                      The system this deployment belongs to
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
                      placeholder="Web App, API Service, Database..."
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your deployment
                  </FormDescription>
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
                    <Input
                      placeholder="web-app, api-service..."
                      {...field}
                      onChange={(e) => {
                        form.setValue("slug", e.target.value, {
                          shouldDirty: true,
                        });
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    A unique identifier for the deployment (URL-friendly)
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
                      placeholder="Describe what this deployment manages..."
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
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
                Create Deployment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
