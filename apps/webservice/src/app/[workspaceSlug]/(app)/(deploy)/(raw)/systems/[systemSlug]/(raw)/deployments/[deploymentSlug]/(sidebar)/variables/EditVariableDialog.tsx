import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Textarea } from "@ctrlplane/ui/textarea";

import type { VariableData } from "./variable-data";
import { api } from "~/trpc/react";

const schema = z.object({
  key: z.string().min(1),
  description: z.string().max(1000).optional(),
  defaultValueId: z.string().uuid().nullable(),
});

type EditVariableDialogProps = {
  variable: VariableData;
  onClose: () => void;
  children: React.ReactNode;
};

export const EditVariableDialog: React.FC<EditVariableDialogProps> = ({
  variable,
  onClose,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const update = api.deployment.variable.update.useMutation();
  const router = useRouter();
  const form = useForm({ schema, defaultValues: { ...variable } });

  const onSubmit = form.handleSubmit(async (data) =>
    update
      .mutateAsync({ id: variable.id, data })
      .then(() => form.reset(data))
      .then(() => router.refresh())
      .then(() => setOpen(false)),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultValueId"
              render={({ field: { value, onChange } }) => (
                <FormItem>
                  <FormLabel>Default value</FormLabel>
                  <FormControl>
                    <Select value={value ?? undefined} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Default value..." />
                      </SelectTrigger>
                      <SelectContent>
                        {variable.values.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {SCHEMA.isDeploymentVariableValueDirect(v) &&
                              (typeof v.value === "object"
                                ? JSON.stringify(v.value)
                                : v.value)}

                            {SCHEMA.isDeploymentVariableValueReference(v) &&
                              v.reference}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
