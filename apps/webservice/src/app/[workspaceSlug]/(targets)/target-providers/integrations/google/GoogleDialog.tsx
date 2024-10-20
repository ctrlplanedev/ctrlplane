"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconBulb } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

export const createGoogleSchema = z.object({
  name: z.string(),
  projectId: z.string(),
});

type CreateGoogleConfig = z.infer<typeof createGoogleSchema>;

export const GoogleDialog: React.FC<{
  workspace: Workspace;
  children: React.ReactNode;
}> = ({ children, workspace }) => {
  const { data: integrations, isLoading: isLoadingIntegrations } =
    api.workspace.integrations.google.listIntegrations.useQuery(workspace.id);

  const form = useForm<CreateGoogleConfig>({
    resolver: zodResolver(createGoogleSchema),
    defaultValues: { projectId: "" },
    mode: "onChange",
  });

  const router = useRouter();
  const utils = api.useUtils();
  const create = api.target.provider.managed.google.create.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    await create.mutateAsync({
      ...data,
      workspaceId: workspace.id,
      config: { projectIds: [data.projectId] },
    });
    await utils.target.provider.byWorkspaceId.invalidate();
    router.refresh();
    router.push(`/${workspace.slug}/target-providers`);
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
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
