"use client";

import type { TargetMetadataGroup } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TbBulb, TbX } from "react-icons/tb";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@ctrlplane/ui/alert";
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
import { NullCombinationsExample } from "./NullCombinationsExample";

const metadataGroupFormSchema = z.object({
  name: z.string().min(1),
  keys: z.array(z.object({ value: z.string().min(1) })).min(1),
  description: z.string(),
  includeNullCombinations: z.boolean().optional(),
});

export const EditMetadataGroupDialog: React.FC<{
  workspaceId: string;
  children: React.ReactNode;
  metadataGroup: TargetMetadataGroup;
  parentClose?: () => void;
}> = ({ workspaceId, metadataGroup, children, parentClose }) => {
  const [open, setOpen] = useState(false);
  const updateMetadataGroup = api.target.metadataGroup.update.useMutation();
  const utils = api.useUtils();
  const [input, setInput] = useState("");
  const router = useRouter();
  const form = useForm({
    schema: metadataGroupFormSchema,
    defaultValues: {
      name: metadataGroup.name,
      description: metadataGroup.description,
      keys: metadataGroup.keys.map((key) => ({ value: key })),
      includeNullCombinations: metadataGroup.includeNullCombinations,
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    name: "keys",
    control: form.control,
  });

  const onSubmit = form.handleSubmit((values) =>
    updateMetadataGroup
      .mutateAsync({
        id: metadataGroup.id,
        data: {
          ...values,
          keys: values.keys.map((key) => key.value),
        },
      })
      .then(() => utils.target.metadataGroup.groups.invalidate())
      .then(() => parentClose?.())
      .then(() => setOpen(false))
      .then(() => router.refresh()),
  );

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
          <DialogTitle>Edit Metadata Group</DialogTitle>
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
              {fields.length === 0 && (
                <p className="h-[30px] text-xs text-muted-foreground">
                  No keys added
                </p>
              )}
              {fields.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
            </div>

            <div className="flex items-center gap-3">
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

            <FormField
              control={form.control}
              name="includeNullCombinations"
              render={({ field: { value, onChange } }) => (
                <FormItem className="flex flex-col gap-2">
                  <FormLabel>Include Null Combinations?</FormLabel>
                  <Alert variant="secondary">
                    <TbBulb className="h-5 w-5" />
                    <AlertTitle>Null Combinations</AlertTitle>
                    <AlertDescription>
                      If enabled, combinations with null values will be
                      included. For example, if the keys "env" and "tier" are
                      selected, the following combinations will be tracked in
                      this metadata group: <NullCombinationsExample />
                    </AlertDescription>
                  </Alert>
                  <FormControl>
                    <Switch checked={value} onCheckedChange={onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isDirty}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
