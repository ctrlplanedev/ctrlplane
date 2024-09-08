"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TbCheck, TbCopy, TbX } from "react-icons/tb";
import { useCopyToClipboard } from "react-use";

import { cn } from "@ctrlplane/ui";
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
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";

import { api } from "~/trpc/react";
import { Callout } from "../../../../_components/Callout";
import { createGoogleSchema } from "./GoogleDialog";

export const UpdateGoogleProviderDialog: React.FC<{
  providerId: string;
  name: string;
  projectIds: string[];
  onClose?: () => void;
  children: React.ReactNode;
}> = ({ providerId, name, projectIds, onClose, children }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const form = useForm({
    schema: createGoogleSchema,
    defaultValues: { name, projectIds: projectIds.map((p) => ({ value: p })) },
    mode: "onChange",
  });

  const utils = api.useUtils();
  const update = api.target.provider.managed.google.update.useMutation();
  const onSubmit = form.handleSubmit(async (data) => {
    if (workspace.data == null) return;
    await update.mutateAsync({
      ...data,
      targetProviderId: providerId,
      config: { projectIds: data.projectIds.map((p) => p.value) },
    });
    await utils.target.provider.byWorkspaceId.invalidate();
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
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Configure Google Provider</DialogTitle>
              <DialogDescription>
                Google provider allows you to configure and import GKE clusters
                from google.
              </DialogDescription>

              <Callout>
                <span>
                  To use the Google provider, you will need to invite our
                  service account to your project and configure the necessary
                  permissions. Read more{" "}
                  <Link
                    href="https://docs.ctrlplane.dev/integrations/google-cloud/compute-scanner"
                    className="underline"
                    target="_blank"
                  >
                    here
                  </Link>
                  .
                </span>
              </Callout>
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
                    <TbCheck className="h-4 w-4 bg-neutral-950 text-green-500" />
                  ) : (
                    <TbCopy className="h-4 w-4" />
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
                              <TbX className="h-4 w-4" />
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
