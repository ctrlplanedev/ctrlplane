import type { DeploymentVariable } from "@ctrlplane/db/schema";
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

import { api } from "~/trpc/react";

const schema = z.object({ value: z.string() });

export const AddVariableValueDialog: React.FC<{
  variable: DeploymentVariable;
  children?: React.ReactNode;
}> = ({ children, variable }) => {
  const [open, setOpen] = useState(false);

  const create = api.deployment.variable.value.create.useMutation();
  const utils = api.useUtils();
  const form = useForm({ schema, defaultValues: { value: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync({ ...values, variableId: variable.id });
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
              <DialogTitle>Add Value</DialogTitle>
              <DialogDescription>value are things</DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input placeholder="" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
