"use client";

import { useState } from "react";
import { z } from "zod";

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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const schema = z.object({ key: z.string(), description: z.string() });

export const CreateVaribaleDialog: React.FC<{
  deploymentId: string;
  children?: React.ReactNode;
}> = ({ children, deploymentId }) => {
  const [open, setOpen] = useState(false);
  const create = api.deployment.variable.create.useMutation();
  const utils = api.useUtils();
  const form = useForm({ schema, defaultValues: { description: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync({ ...values, deploymentId });
    await utils.deployment.variable.byDeploymentId.invalidate();
    setOpen(false);
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Add Variable</DialogTitle>
              <DialogDescription>Variables are things</DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="my-variable, MY_VARIABLE..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
