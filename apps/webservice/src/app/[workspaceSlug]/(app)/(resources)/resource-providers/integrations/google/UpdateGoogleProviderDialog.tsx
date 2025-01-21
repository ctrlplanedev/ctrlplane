"use client";

import type { ResourceProviderGoogle } from "@ctrlplane/db/schema";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconBulb, IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { useCopyToClipboard } from "react-use";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Switch } from "@ctrlplane/ui/switch";

import { api } from "~/trpc/react";
import { createGoogleSchema } from "./GoogleDialog";

const formSchema = createGoogleSchema.and(
  z.object({ repeatSeconds: z.number() }),
);

export const UpdateGoogleProviderDialog: React.FC<{
  providerId: string;
  name: string;
  googleConfig: ResourceProviderGoogle | null;
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ providerId, googleConfig, name, onClose, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const form = useForm({
    schema: formSchema,
    defaultValues: {
      name,
      ...googleConfig,
      projectIds: googleConfig?.projectIds.map((p) => ({ value: p })) ?? [],
      repeatSeconds: 0,
    },
    mode: "onChange",
  });

  const utils = api.useUtils();
  const update = api.resource.provider.managed.google.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({
      ...data,
      resourceProviderId: providerId,
      config: {
        ...data,
        projectIds: data.projectIds.map((p) => p.value),
      },
      repeatSeconds: data.repeatSeconds === 0 ? null : data.repeatSeconds,
    });
    await utils.resource.provider.byWorkspaceId.invalidate();
    setOpen(false);
    onClose?.();
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "projectIds",
  });

  const [open, setOpen] = useState(false);

  const [isCopied, setIsCopied] = useState(false);
  const [, copy] = useCopyToClipboard();
  const handleCopy = () => {
    copy(workspace.data?.googleServiceAccountEmail ?? "");
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  };

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
      <DialogContent className={"max-h-screen overflow-y-scroll"}>
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

            <div className="space-y-2">
              <Label>Service Account</Label>
              <div className="relative flex items-center">
                <Input
                  value={workspace.data?.googleServiceAccountEmail ?? ""}
                  className="disabled:cursor-default"
                  disabled
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2 h-4 w-4 bg-neutral-950 backdrop-blur-sm transition-all hover:bg-neutral-950 focus-visible:ring-0"
                >
                  {isCopied ? (
                    <IconCheck className="h-4 w-4 bg-neutral-950 text-green-500" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

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
                        <div className="relative flex items-center">
                          <Input placeholder="my-gcp-project-id" {...field} />

                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 h-4 w-4 bg-neutral-950 hover:bg-neutral-950"
                              onClick={() => remove(index)}
                            >
                              <IconX className="h-4 w-4" />
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

            <FormField
              control={form.control}
              name="importGke"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Import GKE Clusters</FormLabel>
                    <FormDescription>
                      Enable importing of Google Kubernetes Engine (GKE)
                      clusters
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importNamespaces"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Import Namespaces</FormLabel>
                    <FormDescription>
                      Enable importing of Kubernetes namespaces clusters
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importVCluster"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Import vClusters</FormLabel>
                    <FormDescription>
                      Enable importing of vClusters
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importVpc"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Import VPC</FormLabel>
                    <FormDescription>Enable importing of VPCs</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="importVms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Import VMs</FormLabel>
                    <FormDescription>Enable importing of VMs</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repeatSeconds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scan Frequency (seconds)</FormLabel>

                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
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
