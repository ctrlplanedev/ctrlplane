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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";

// Validation schema for resource creation
const createResourceSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(255, { message: "Name must be at most 255 characters long" }),
  identifier: z
    .string()
    .min(1, { message: "Identifier is required" })
    .max(255, { message: "Identifier must be at most 255 characters long" })
    .regex(/^[a-z0-9-_:.]+$/, {
      message:
        "Identifier must contain only lowercase letters, numbers, hyphens, underscores, colons, and periods",
    }),
  kind: z
    .string()
    .min(1, { message: "Kind is required" })
    .max(100, { message: "Kind must be at most 100 characters long" }),
  metadata: z.array(
    z.object({
      key: z.string().min(1, { message: "Key is required" }),
      value: z.string(),
    }),
  ),
  config: z.array(
    z.object({
      key: z.string().min(1, { message: "Key is required" }),
      value: z.string(),
    }),
  ),
});

type CreateResourceFormData = z.infer<typeof createResourceSchema>;

type CreateResourceDialogProps = {
  children?: ReactNode;
  onSuccess?: (resource: { id: string; name: string }) => void;
};

export function CreateResourceDialog({
  children,
  onSuccess,
}: CreateResourceDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const form = useForm<CreateResourceFormData>({
    resolver: zodResolver(createResourceSchema),
    defaultValues: {
      name: "",
      identifier: "",
      kind: "server",
      metadata: [],
      config: [],
    },
  });

  const {
    fields: metadataFields,
    append: appendMetadata,
    remove: removeMetadata,
  } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  const {
    fields: configFields,
    append: appendConfig,
    remove: removeConfig,
  } = useFieldArray({
    control: form.control,
    name: "config",
  });

  // Auto-generate identifier from name
  const handleNameChange = (value: string) => {
    form.setValue("name", value);
    // Auto-generate identifier from name (convert to lowercase, replace spaces/special chars with hyphens)
    const autoIdentifier = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!form.formState.dirtyFields.identifier) {
      form.setValue("identifier", autoIdentifier);
    }
  };

  const createResourceMutation = trpc.resource.create.useMutation({
    onSuccess: (resource) => {
      toast.success("Resource created successfully");
      setOpen(false);
      form.reset();

      // Invalidate resources list to refetch
      void utils.resource.list.invalidate();

      onSuccess?.({
        id: resource.id,
        name: resource.name,
      });
    },
    onError: (error) => {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to create resource";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const workspaceId = workspace.id;

      // Convert arrays to objects
      const metadata = Object.fromEntries(
        data.metadata.map((m) => [m.key, m.value]),
      );
      const config = Object.fromEntries(
        data.config.map((c) => {
          // Try to parse JSON for config values
          try {
            return [c.key, JSON.parse(c.value)];
          } catch {
            return [c.key, c.value];
          }
        }),
      );

      await createResourceMutation.mutateAsync({
        workspaceId,
        name: data.name,
        identifier: data.identifier,
        kind: data.kind,
        version: "v1",
        config,
        metadata,
      });
    } catch (err: unknown) {
      // Error is handled by the mutation's onError callback
      console.error("Failed to create resource:", err);
    }
  });

  const isSubmitting = createResourceMutation.isPending;

  // Common resource kinds
  const resourceKinds = [
    "server",
    "container",
    "database",
    "load-balancer",
    "storage",
    "network",
    "application",
    "service",
    "cluster",
    "other",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>Create Resource</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Resource</DialogTitle>
          <DialogDescription>
            Create a new resource to track infrastructure, applications, or
            services.
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
                      placeholder="Production Server, API Database..."
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your resource
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifier</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="prod-server-01, api-db..."
                      {...field}
                      onChange={(e) => {
                        form.setValue("identifier", e.target.value, {
                          shouldDirty: true,
                        });
                      }}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    A unique identifier for the resource
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kind</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select resource kind" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {resourceKinds.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {kind.charAt(0).toUpperCase() + kind.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The type of resource being created
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Metadata Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Metadata (Optional)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendMetadata({ key: "", value: "" })}
                  disabled={isSubmitting}
                >
                  <PlusIcon className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {metadataFields.length > 0 && (
                <div className="space-y-2">
                  {metadataFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <FormField
                        control={form.control}
                        name={`metadata.${index}.key`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="key"
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
                        name={`metadata.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="value"
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
                        onClick={() => removeMetadata(index)}
                        disabled={isSubmitting}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <FormDescription>
                Key-value pairs for resource metadata
              </FormDescription>
            </div>

            {/* Config Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Config (Optional)</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendConfig({ key: "", value: "" })}
                  disabled={isSubmitting}
                >
                  <PlusIcon className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {configFields.length > 0 && (
                <div className="space-y-2">
                  {configFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <FormField
                        control={form.control}
                        name={`config.${index}.key`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="key"
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
                        name={`config.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                placeholder="value (JSON supported)"
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
                        onClick={() => removeConfig(index)}
                        disabled={isSubmitting}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <FormDescription>
                Key-value pairs for resource configuration (values can be JSON)
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
                Create Resource
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
