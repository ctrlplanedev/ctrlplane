/* eslint-disable @typescript-eslint/no-unsafe-call */
"use client";

import { useState } from "react";
import { IconDots } from "@tabler/icons-react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

const ValueInput: React.FC<{
  value: any;
  onChange: (v: any) => void;
  possibleValues: any[];
}> = ({ possibleValues, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="flex flex-grow gap-2"
      >
        <Input
          className="w-full"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={value == null ? "NULL" : ""}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[300px] overflow-x-auto p-0 text-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {possibleValues.map((k) => (
          <Button
            variant="ghost"
            size="sm"
            key={k}
            className="w-full rounded-none text-left"
            onClick={(e) => {
              e.preventDefault();
              onChange(k?.toString());
              setOpen(false);
            }}
          >
            <div className="w-full">{JSON.stringify(k)}</div>
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

const VariableRow: React.FC<{
  variableId: string;
  varKey: string;
  description: string;
  targetId: string;
  value?: string | null;
  possibleValues: any[];
}> = ({ variableId, targetId, varKey, description, value, possibleValues }) => {
  const [edit, setEdit] = useState(false);

  const form = useForm({
    schema: z.object({ key: z.string(), value: z.string() }),
    defaultValues: { key: varKey, value },
  });
  console.log(value);
  const set = api.deployment.variable.value.setTarget.useMutation();
  const utils = api.useUtils();
  const onSubmit = form.handleSubmit(async ({ value }) => {
    await set.mutateAsync({ value, variableId, targetId });
    await utils.deployment.variable.byTargetId.invalidate(targetId);
    setEdit(false);
  });

  if (edit) {
    return (
      <TableRow className="border-x hover:bg-inherit">
        <TableCell colSpan={4} className="bg-neutral-900/40 drop-shadow-xl">
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-3 p-6">
              <div className="flex items-end gap-3">
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem className="max-w-[300px] flex-grow">
                      <FormLabel>Key</FormLabel>
                      <FormControl>
                        <Input
                          className="w-full"
                          disabled
                          placeholder=""
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field: { value, onChange } }) => (
                    <FormItem className="flex-grow">
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <div className="flex w-full">
                          <ValueInput
                            onChange={onChange}
                            value={value}
                            possibleValues={possibleValues}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="destructive"
                  disabled={set.isPending || value == null}
                  onClick={async () => {
                    await set.mutateAsync({
                      value: null,
                      variableId,
                      targetId,
                    });
                    await utils.deployment.variable.byTargetId.invalidate(
                      targetId,
                    );
                    setEdit(false);
                  }}
                >
                  Clear
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={set.isPending}
                  onClick={() => setEdit(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" disabled={set.isPending}>
                  Save
                </Button>
              </div>
            </form>
          </Form>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="w-[500px] p-3">
        <div className="flex items-center gap-2">
          <div>{varKey}</div>
        </div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </TableCell>
      <TableCell className="p-3">
        {value ?? <div className="italic text-neutral-500">NULL</div>}
      </TableCell>
      <TableCell className="w-10 p-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => setEdit(true)}
        >
          <IconDots className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

export const VariableContent: React.FC<{ targetId: string }> = ({
  targetId,
}) => {
  const deployments = api.deployment.byTargetId.useQuery(targetId);
  const variables = api.deployment.variable.byTargetId.useQuery(targetId);
  return (
    <div>
      {deployments.data?.map((deployment) => {
        return (
          <div key={deployment.id} className="space-y-6 border-b p-24">
            <div className="text-lg font-semibold">{deployment.name}</div>

            <Table className="w-full">
              <TableHeader className="text-left">
                <TableRow className="text-sm">
                  <TableHead className="p-3">Keys</TableHead>
                  <TableHead className="p-3">Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.data
                  ?.filter((v) => v.deploymentId === deployment.id)
                  .map((v) => (
                    <VariableRow
                      key={v.id}
                      variableId={v.id}
                      targetId={targetId}
                      varKey={v.key}
                      value={v.value.value}
                      description={v.description}
                      possibleValues={v.possibleValues}
                    />
                  ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
};
