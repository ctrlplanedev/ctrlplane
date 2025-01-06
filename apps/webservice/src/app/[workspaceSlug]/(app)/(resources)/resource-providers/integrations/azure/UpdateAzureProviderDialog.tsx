"use client";

import type { UpdateResourceProviderAzure } from "@ctrlplane/db/schema";
import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateResourceProviderAzure } from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
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

type UpdateAzureProviderDialogProps = {
  workspaceId: string;
  resourceProvider: SCHEMA.ResourceProvider;
  azureConfig: SCHEMA.ResourceProviderAzure;
  children: React.ReactNode;
  onClose?: () => void;
};

export const UpdateAzureProviderDialog: React.FC<
  UpdateAzureProviderDialogProps
> = ({ workspaceId, resourceProvider, azureConfig, children, onClose }) => {
  const [open, setOpen] = useState(false);
  const form = useForm({
    schema: updateResourceProviderAzure,
    defaultValues: { ...azureConfig, ...resourceProvider },
  });
  const router = useRouter();

  const onSubmit = form.handleSubmit((data: UpdateResourceProviderAzure) => {
    setOpen(false);
    router.push(
      `/api/azure/${workspaceId}/${data.tenantId}/${data.subscriptionId}/${data.name}?resourceProviderId=${resourceProvider.id}`,
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose?.();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Azure</DialogTitle>
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tenantId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tenant ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subscriptionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription ID</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={
                !form.formState.isValid ||
                form.formState.isSubmitting ||
                !form.formState.isDirty
              }
            >
              Save
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
