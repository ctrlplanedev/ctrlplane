import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { Control, UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useWorkspace } from "~/components/WorkspaceProvider";

const systemSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Name must be at least 3 characters long" })
    .max(100, { message: "Name must be at most 100 characters long" }),
  description: z
    .string()
    .max(255, { message: "Description must be at most 255 characters long" })
    .optional(),
});

type CreateSystemDialogProps = {
  children?: React.ReactNode;
  onSuccess?: (system: WorkspaceEngine["schemas"]["System"]) => void;
};

const useFormSubmit = (
  form: UseFormReturn<z.infer<typeof systemSchema>>,
  closeDialog: () => void,
  onSuccess?: (system: WorkspaceEngine["schemas"]["System"]) => void,
) => {
  const { workspace } = useWorkspace();
  const createSystemMutation = trpc.system.create.useMutation();

  return form.handleSubmit((data) =>
    createSystemMutation
      .mutateAsync({ workspaceId: workspace.id, ...data })
      .then((system) => onSuccess?.(system))
      .then(() => closeDialog())
      .then(() => form.reset())
      .then(() => toast.success("System created successfully"))
      .catch((error) => {
        const message =
          "message" in error && typeof error.message === "string"
            ? error.message
            : "Failed to create system";
        toast.error(message);
      }),
  );
};

type FormControl = {
  control: Control<z.infer<typeof systemSchema>>;
};

const NameField = ({ control }: FormControl) => (
  <FormField
    control={control}
    name="name"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const DescriptionField = ({ control }: FormControl) => (
  <FormField
    control={control}
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
);

export function CreateSystemDialog({
  children,
  onSuccess,
}: CreateSystemDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof systemSchema>>({
    resolver: zodResolver(systemSchema),
    defaultValues: { name: "", description: "" },
  });

  const onFormSubmit = useFormSubmit(form, () => setOpen(false), onSuccess);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onFormSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>New System</DialogTitle>
              <DialogDescription>
                Systems are a group of processes, releases, and runbooks for
                applications or services.
              </DialogDescription>
            </DialogHeader>
            <NameField {...form} />
            <DescriptionField {...form} />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Create System</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
