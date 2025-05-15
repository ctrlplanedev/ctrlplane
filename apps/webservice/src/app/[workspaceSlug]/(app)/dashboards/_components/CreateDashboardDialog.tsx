"use client";

import React from "react";
import { useRouter } from "next/navigation";

import * as SCHEMA from "@ctrlplane/db/schema";
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
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

export const CreateDashboardDialog: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const router = useRouter();
  const form = useForm({
    schema: SCHEMA.createDashboard,
    defaultValues: {
      name: "",
      description: "",
      workspaceId,
    },
  });
  const createDashboard = api.dashboard.create.useMutation();

  const onSubmit = form.handleSubmit((data) =>
    createDashboard.mutateAsync(data).then(() => router.refresh()),
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Create Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Dashboard</DialogTitle>
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
                    <Textarea {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={createDashboard.isPending}>
              Create Dashboard
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
