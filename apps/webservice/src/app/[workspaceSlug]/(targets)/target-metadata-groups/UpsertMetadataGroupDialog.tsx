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
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";

const MetadataFilterInput: React.FC<{
  value: string;
  workspaceId: string;
  onChange: (value: string) => void;
}> = ({ value, workspaceId, onChange }) => {
  const { data: metadataKeys } = api.target.metadataKeys.useQuery(workspaceId);
  const [open, setOpen] = useState(false);
  const filteredLabels = useMatchSorter(metadataKeys ?? [], value);
  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={(e) => e.stopPropagation()}
          className="flex-grow"
        >
          <Input
            placeholder="Key"
            className="h-8"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[300px] w-[23rem] overflow-auto p-0 text-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredLabels.map((k) => (
            <Button
              variant="ghost"
              size="sm"
              key={k}
              className="w-full rounded-none text-left"
              onClick={(e) => {
                e.preventDefault();
                onChange(k);
                setOpen(false);
              }}
            >
              <div className="w-full">{k}</div>
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};

const metadataGroupFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  keys: z.array(z.object({ value: z.string().min(1) })).min(1),
  description: z.string(),
});

export const UpsertMetadataGroupDialog: React.FC<{
  workspaceId: string;
  create: boolean;
  children: React.ReactNode;
  values?: z.infer<typeof metadataGroupFormSchema>;
  parentClose?: () => void;
}> = ({ workspaceId, create, values, children, parentClose }) => {
  const [open, setOpen] = useState(false);
  const createMetadataGroup = api.target.metadataGroup.upsert.useMutation();
  const utils = api.useUtils();
  const [input, setInput] = useState("");
  const router = useRouter();
  const form = useForm({
    schema: metadataGroupFormSchema,
    defaultValues: values ?? {
      name: "",
      keys: [],
      description: "",
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    name: "keys",
    control: form.control,
  });

  const onSubmit = form.handleSubmit((values) =>
    createMetadataGroup
      .mutateAsync({
        data: {
          id: values.id,
          name: values.name,
          keys: values.keys.map((key) => key.value),
          description: values.description,
        },
        workspaceId,
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
          <DialogTitle>{create ? "Create" : "Edit"} Label Group</DialogTitle>
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
                <div className="flex flex-wrap gap-1">
                  {fields.map((field, index) => (
                    <Badge
                      key={field.id}
                      variant="outline"
                      className="flex w-min items-center gap-1 text-nowrap px-2 py-1 text-xs"
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
                  Add Label
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isDirty}>
                {create ? "Create" : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
