"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TbX } from "react-icons/tb";
import { z } from "zod";

import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
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
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Switch } from "@ctrlplane/ui/switch";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { MetadataFilterInput } from "./MetadataFilterInput";

const metadataGroupFormSchema = z.object({
  name: z.string().min(1),
  keys: z.array(z.object({ value: z.string().min(1) })).min(1),
  description: z.string(),
  includeNullCombinations: z.boolean().optional(),
});

export const CreateMetadataGroupDialog: React.FC<{
  workspaceId: string;
  children: React.ReactNode;
}> = ({ workspaceId, children }) => {
  const [open, setOpen] = useState(false);
  const createMetadataGroup = api.target.metadataGroup.create.useMutation();
  const utils = api.useUtils();
  const [input, setInput] = useState("");
  const router = useRouter();
  const form = useForm({
    schema: metadataGroupFormSchema,
    defaultValues: {
      name: "",
      keys: [],
      description: "",
      includeNullCombinations: false,
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    name: "keys",
    control: form.control,
  });

  const onSubmit = form.handleSubmit((values) => {
    console.log(">>> values", { values });
    createMetadataGroup
      .mutateAsync({
        ...values,
        keys: values.keys.map((key) => key.value),
        workspaceId,
      })
      .then(() => utils.target.metadataGroup.groups.invalidate())
      .then(() => setOpen(false))
      .then(() => router.refresh());
  });

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        setOpen((open) => !open);
        form.reset();
        router.refresh();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Metadata Group</DialogTitle>
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

            <div>
              <Label>Keys</Label>
              {fields.length > 0 && (
                <div className="mb-1 flex flex-wrap gap-1">
                  {fields.map((field, index) => (
                    <Badge
                      key={field.id}
                      variant="outline"
                      className="flex w-fit items-center gap-1 text-nowrap px-2 py-1 text-xs"
                    >
                      {field.value}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => remove(index)}
                      >
                        <TbX className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-1 flex items-center gap-3">
                <div className="flex-grow">
                  <MetadataFilterInput
                    value={input}
                    workspaceId={workspaceId}
                    onChange={setInput}
                    selectedKeys={fields.map((field) => field.value)}
                  />
                </div>
                <div className="ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={input === ""}
                    onClick={() => {
                      append({ value: input });
                      setInput("");
                    }}
                  >
                    Add Key
                  </Button>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="includeNullCombinations"
              render={({ field: { value, onChange } }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl className="mt-2">
                    <Switch checked={value} onCheckedChange={onChange} />
                  </FormControl>{" "}
                  <FormLabel>Include Null Combinations?</FormLabel>
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
