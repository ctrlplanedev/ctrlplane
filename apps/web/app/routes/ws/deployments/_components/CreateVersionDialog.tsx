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

// Validation schema for version creation
const createVersionSchema = z.object({
  deploymentId: z.string().uuid({ message: "Valid deployment ID is required" }),
  tag: z
    .string()
    .min(1, { message: "Tag is required" })
    .max(255, { message: "Tag must be at most 255 characters long" }),
  name: z
    .string()
    .max(255, { message: "Name must be at most 255 characters long" })
    .optional(),
  status: z.enum(["building", "ready", "failed", "rejected"]).default("ready"),
  message: z
    .string()
    .max(500, { message: "Message must be at most 500 characters long" })
    .optional(),
});

type CreateVersionFormData = z.infer<typeof createVersionSchema>;

type VersionCreateDialogProps = {
  children?: ReactNode;
  deploymentId?: string;
  onSuccess?: (version: { id: string; tag: string }) => void;
};

export function CreateVersionDialog({
  children,
  deploymentId,
  onSuccess,
}: VersionCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  // Fetch deployments for the workspace
  const { data: deploymentsData, isLoading: deploymentsLoading } =
    trpc.deployment.list.useQuery({ workspaceId: workspace.id });

  const form = useForm<CreateVersionFormData>({
    resolver: zodResolver(createVersionSchema),
    defaultValues: {
      deploymentId: deploymentId ?? "",
      tag: "",
      name: "",
      status: "ready",
      message: "",
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const createVersionMutation = trpc.deployment.createVersion.useMutation({
    onSuccess: async (version) => {
      toast.success("Version created successfully");
      setOpen(false);
      form.reset();

      // Invalidate versions list to refetch
      await utils.deployment.versions.invalidate();

      onSuccess?.({
        id: version.id,
        tag: version.tag,
      });
    },
    onError: (error) => {
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Failed to create version";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const workspaceId = workspace.id;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await createVersionMutation.mutateAsync({
        workspaceId,
        ...data,
        name: data.name ?? data.tag,
      });
    } catch (err: unknown) {
      // Error is handled by the mutation's onError callback
      console.error("Failed to create version:", err);
    }
  });

  const isSubmitting = createVersionMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? <Button>Create Version</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Version</DialogTitle>
          <DialogDescription>
            Create a new version for your deployment to track releases and
            rollouts.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {!deploymentId && (
              <FormField
                control={form.control}
                name="deploymentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deployment</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || deploymentsLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a deployment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deploymentsData?.items.map((item) => (
                          <SelectItem
                            key={item.deployment.id}
                            value={item.deployment.id}
                          >
                            {item.deployment.name}
                          </SelectItem>
                        )) ?? []}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The deployment this version belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="tag"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="v1.0.0, main-abc123, latest..."
                      {...field}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </FormControl>
                  <FormDescription>
                    A unique tag to identify this version (e.g., version number,
                    commit hash)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Leave empty to use tag as name"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    A friendly name for this version (defaults to tag if not
                    provided)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="building">Building</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The current status of this version
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add release notes, changelog, or status message..."
                      {...field}
                      disabled={isSubmitting}
                      rows={3}
                    />
                  </FormControl>
                  <FormDescription>
                    Additional information about this version
                  </FormDescription>
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
                Create Version
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
