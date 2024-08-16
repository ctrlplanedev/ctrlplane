"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TbDots, TbX } from "react-icons/tb";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ctrlplane/ui/alert-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";
import { useMatchSorter } from "../../_components/useMatchSorter";

const LabelFilterInput: React.FC<{
  value: string;
  workspaceId?: string;
  onChange: (value: string) => void;
}> = ({ value, workspaceId, onChange }) => {
  const { data: labelKeys } = api.target.labelKeys.useQuery(workspaceId, {
    enabled: workspaceId != null,
  });
  const [open, setOpen] = useState(false);
  const filteredLabels = useMatchSorter(labelKeys ?? [], value);
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
          className="max-h-[300px] overflow-x-auto p-0 text-sm"
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

const labelGroupFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  keys: z.array(z.object({ value: z.string().min(1) })).min(1),
  description: z.string(),
});

const UpsertLabelGroupDialog: React.FC<{
  workspaceId: string;
  create: boolean;
  children: React.ReactNode;
  values?: z.infer<typeof labelGroupFormSchema>;
  parentClose?: () => void;
}> = ({ workspaceId, create, values, children, parentClose }) => {
  const [open, setOpen] = useState(false);
  const createLabelGroup = api.target.labelGroup.upsert.useMutation();
  const utils = api.useUtils();
  const [input, setInput] = useState("");

  const form = useForm({
    schema: labelGroupFormSchema,
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
    createLabelGroup
      .mutateAsync({
        data: {
          id: values.id,
          name: values.name,
          keys: values.keys.map((key) => key.value),
          description: values.description,
        },
        workspaceId,
      })
      .then(() => utils.target.labelGroup.groups.invalidate())
      .then(() => parentClose?.())
      .then(() => setOpen(false)),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        setOpen((open) => !open);
        !create && form.reset();
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

            <div className="flex items-center gap-2">
              <LabelFilterInput
                value={input}
                workspaceId={workspaceId}
                onChange={setInput}
              />
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

const DeleteLabelGroupDialog: React.FC<{
  id: string;
  children: React.ReactNode;
}> = ({ id, children }) => {
  const [open, setOpen] = useState(false);
  const deleteLabelGroup = api.target.labelGroup.delete.useMutation();
  const utils = api.useUtils();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Label Group</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          Are you sure you want to delete this label group?
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              deleteLabelGroup
                .mutateAsync(id)
                .then(() => utils.target.labelGroup.groups.invalidate())
                .then(() => setOpen(false));
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default function TargetLabelGroupPages({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);

  const labelGroups = api.target.labelGroup.groups.useQuery(
    workspace.data?.id ?? "",
    { enabled: workspace.isSuccess },
  );

  const [openDropdownId, setOpenDropdownId] = useState("");

  if (workspace.isSuccess && workspace.data == null) return notFound();

  return (
    <div>
      <div className="flex items-center gap-3 border-b p-4 px-8 text-xl">
        <div className="flex flex-grow items-center gap-2">
          <span>Groups</span>
        </div>
        <UpsertLabelGroupDialog workspaceId={workspace.data?.id ?? ""} create>
          <Button variant="outline">Create Group</Button>
        </UpsertLabelGroupDialog>
      </div>

      <Table className="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Keys</TableHead>
            <TableHead>Targets</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labelGroups.data?.map((labelGroup) => (
            <TableRow
              key={labelGroup.targetLabelGroup.id}
              className="cursor-pointer border-b-neutral-800/50"
            >
              <TableCell>{labelGroup.targetLabelGroup.name}</TableCell>
              <TableCell>
                <Link
                  href={`/${workspaceSlug}/target-label-groups/${labelGroup.targetLabelGroup.id}`}
                >
                  <div className="flex flex-col font-mono text-xs text-red-400">
                    {labelGroup.targetLabelGroup.keys.map((key) => (
                      <span key={key}>{key}</span>
                    ))}
                  </div>
                </Link>
              </TableCell>
              <TableCell>{labelGroup.targets}</TableCell>
              <TableCell className="flex justify-end">
                <DropdownMenu
                  open={openDropdownId === labelGroup.targetLabelGroup.id}
                  onOpenChange={(open) => {
                    if (open) setOpenDropdownId(labelGroup.targetLabelGroup.id);
                    if (!open) setOpenDropdownId("");
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <TbDots className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <UpsertLabelGroupDialog
                      workspaceId={workspace.data?.id ?? ""}
                      create={false}
                      parentClose={() => setOpenDropdownId("")}
                      values={{
                        id: labelGroup.targetLabelGroup.id,
                        name: labelGroup.targetLabelGroup.name,
                        keys: labelGroup.targetLabelGroup.keys.map((key) => ({
                          value: key,
                        })),
                        description: labelGroup.targetLabelGroup.description,
                      }}
                    >
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Edit
                      </DropdownMenuItem>
                    </UpsertLabelGroupDialog>
                    <DeleteLabelGroupDialog id={labelGroup.targetLabelGroup.id}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Delete
                      </DropdownMenuItem>
                    </DeleteLabelGroupDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
