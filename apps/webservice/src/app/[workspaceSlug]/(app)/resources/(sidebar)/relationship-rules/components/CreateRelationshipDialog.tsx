"use client";

import { IconPlus } from "@tabler/icons-react";

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

import { api } from "~/trpc/react";

interface CreateRelationshipDialogProps {
  workspaceId: string;
}

export const CreateRelationshipDialog: React.FC<
  CreateRelationshipDialogProps
> = ({ workspaceId }) => {
  const form = useForm({
    defaultValues: {
      reference: "",
      sourceKind: "",
      sourceVersion: "",
      targetKind: "",
      targetVersion: "",
      dependencyType: "required",
    },
  });

  const utils = api.useUtils();
  const createRule = api.resource.relationships.create.useMutation({
    onSuccess: () => {
      utils.resource.relationships.list.invalidate();
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          Add Relationship Rule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Relationship Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              createRule.mutateAsync({ workspaceId, ...data }),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Kind</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetKind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Kind</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit">Create</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
