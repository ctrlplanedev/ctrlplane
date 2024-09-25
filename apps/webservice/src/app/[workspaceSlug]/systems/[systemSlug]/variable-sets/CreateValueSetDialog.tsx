"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import { z } from "zod";

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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  values: z.array(z.object({ key: z.string(), value: z.string() })),
});

export const CreateVariableSetDialog: React.FC<{
  children?: React.ReactNode;
  systemId: string;
}> = ({ children, systemId }) => {
  const create = api.variableSet.create.useMutation();
  const form = useForm({
    schema,
    defaultValues: {
      name: "",
      description: "",
      values: [{ key: "", value: "" }],
    },
  });

  const [open, setOpen] = useState(false);
  const { fields, append, remove } = useFieldArray({
    name: "values",
    control: form.control,
  });

  const router = useRouter();
  const onSubmit = form.handleSubmit(async (data) => {
    await create.mutateAsync({ ...data, systemId });
    form.reset();
    setOpen(false);
    router.refresh();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className={"max-h-screen max-w-2xl overflow-y-scroll"}>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Create Variable Set</DialogTitle>
              <DialogDescription>
                Variable sets are a group of variables.
              </DialogDescription>
            </DialogHeader>

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

            <div>
              {fields.map((field, index) => (
                <FormField
                  control={form.control}
                  key={field.id}
                  name={`values.${index}`}
                  render={({ field: { onChange, value } }) => (
                    <FormItem>
                      <FormLabel className={cn(index !== 0 && "sr-only")}>
                        Values
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Key"
                            value={value.key}
                            onChange={(e) =>
                              onChange({ ...value, key: e.target.value })
                            }
                          />
                          <Input
                            placeholder="Value"
                            value={value.value}
                            onChange={(e) =>
                              onChange({ ...value, value: e.target.value })
                            }
                          />
                          <Button
                            className="shrink-0"
                            size="icon"
                            variant="ghost"
                            onClick={() => remove(index)}
                          >
                            <IconX className="h-4 w-4" />
                          </Button>
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
                onClick={() => append({ key: "", value: "" })}
              >
                Add value
              </Button>
            </div>

            <DialogFooter>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
