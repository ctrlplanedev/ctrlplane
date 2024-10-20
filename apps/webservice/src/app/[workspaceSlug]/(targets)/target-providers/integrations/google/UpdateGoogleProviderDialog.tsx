"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconBulb } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";
import { createGoogleSchema } from "./GoogleDialog";

export const UpdateGoogleProviderDialog: React.FC<{
  providerId: string;
  name: string;
  projectId: string;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ providerId, name, projectId, onClose, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const { data: integrations, isLoading: isLoadingIntegrations } =
    api.workspace.integrations.google.listIntegrations.useQuery(
      workspace.data?.id ?? "",
    );

  const form = useForm({
    schema: createGoogleSchema,
    defaultValues: { name, projectId },
    mode: "onChange",
  });

  const utils = api.useUtils();
  const update = api.target.provider.managed.google.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({
      ...data,
      targetProviderId: providerId,
      config: { projectIds: [data.projectId] },
    });
    await utils.target.provider.byWorkspaceId.invalidate();
    setOpen(false);
    onClose?.();
  });

  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          form.reset();
          onClose?.();
        }
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

              <Alert variant="secondary">
                <IconBulb className="h-5 w-5" />
                <AlertTitle>Google Provider</AlertTitle>
                <AlertDescription>
                  To utilize the Google provider, it's necessary to grant our
                  service account access to your project and set up the required
                  permissions. For detailed instructions, please refer to our{" "}
                  <Link
                    href="https://docs.ctrlplane.dev/integrations/google-cloud/compute-scanner"
                    target="_blank"
                    className="underline"
                  >
                    documentation
                  </Link>
                  .
                </AlertDescription>
              </Alert>
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

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Project</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingIntegrations ? (
                        <SelectItem value="loading" disabled>
                          Loading projects...
                        </SelectItem>
                      ) : integrations && integrations.length > 0 ? (
                        integrations.map((integration) => (
                          <SelectItem
                            key={integration.projectId}
                            value={integration.projectId}
                          >
                            {integration.projectId}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No projects available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
