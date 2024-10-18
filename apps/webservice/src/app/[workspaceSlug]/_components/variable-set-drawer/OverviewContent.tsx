import type * as SCHEMA from "@ctrlplane/db/schema";
import type React from "react";
import { useRouter } from "next/navigation";
import { IconX } from "@tabler/icons-react";
import { z } from "zod";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ctrlplane/ui/command";
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
  FormMessage,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  environmentIds: z.array(z.object({ id: z.string().uuid() })),
  values: z.array(
    z.object({
      key: z.string().refine((data) => data.length > 2, {
        message: "Key must be at least 3 characters",
      }),
      value: z.union([z.string(), z.number(), z.boolean()]).refine((data) => {
        if (typeof data === "string") return data.length > 0;
        return true;
      }),
    }),
  ),
});

export const OverviewContent: React.FC<{
  variableSet: SCHEMA.VariableSet & {
    values: SCHEMA.VariableSetValue[];
    assignments: (SCHEMA.VariableSetAssignment & {
      environment: SCHEMA.Environment;
    })[];
  };
  environments: SCHEMA.Environment[];
}> = ({ variableSet, environments }) => {
  const update = api.variableSet.update.useMutation();

  const description = variableSet.description ?? undefined;
  const environmentIds = variableSet.assignments.map((assignment) => ({
    id: assignment.environmentId,
  }));
  const form = useForm({
    schema,
    defaultValues: { ...variableSet, description, environmentIds },
  });

  const { fields, append, remove } = useFieldArray({
    name: "values",
    control: form.control,
  });

  const {
    fields: envs,
    append: appendEnv,
    remove: removeEnv,
  } = useFieldArray({
    name: "environmentIds",
    control: form.control,
  });

  const router = useRouter();
  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) => {
    const environmentIds = data.environmentIds.map((env) => env.id);
    update
      .mutateAsync({ data: { ...data, environmentIds }, id: variableSet.id })
      .then(() => form.reset(data))
      .then(() => utils.variableSet.byId.invalidate(variableSet.id))
      .then(() => router.refresh());
  });

  const selectedEnvsIds = form.watch("environmentIds").map((env) => env.id);
  const newEnvironments = environments.filter(
    (env) => !selectedEnvsIds.includes(env.id),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3 p-6">
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

        <div className="space-y-2">
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
                      {typeof value.value === "string" && (
                        <Input
                          placeholder="Value"
                          value={value.value}
                          onChange={(e) =>
                            onChange({ ...value, value: e.target.value })
                          }
                        />
                      )}
                      {typeof value.value === "number" && (
                        <Input
                          placeholder="Value"
                          type="number"
                          value={value.value}
                          onChange={(e) => {
                            const num = e.target.valueAsNumber;
                            onChange({ ...value, value: num });
                          }}
                        />
                      )}
                      {typeof value.value === "boolean" && (
                        <Select
                          value={value.value.toString()}
                          onValueChange={(val) =>
                            onChange({ ...value, value: val === "true" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a boolean value" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline" size="sm">
                Add value
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => append({ key: "", value: "" })}
                className="cursor-pointer"
              >
                String
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => append({ key: "", value: 0 })}
                className="cursor-pointer"
              >
                Number
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => append({ key: "", value: false })}
                className="cursor-pointer"
              >
                Boolean
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <Label>Environments</Label>
          <div className="flex flex-wrap gap-2">
            {envs.map((field, index) => (
              <FormField
                control={form.control}
                key={field.id}
                name={`environmentIds.${index}`}
                render={({ field: { value } }) => {
                  const env = environments.find((e) => e.id === value.id)!;
                  return (
                    <Badge
                      key={value.id}
                      variant="outline"
                      className="flex w-fit items-center gap-2 px-2 py-1"
                    >
                      <span>{env.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => removeEnv(index)}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </Badge>
                  );
                }}
              />
            ))}
          </div>
        </div>

        <div>
          <Popover>
            <PopoverTrigger>
              <Button variant="outline" role="combobox" type="button">
                Add environment
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Command>
                <CommandInput placeholder="Search environment" />
                <CommandList>
                  {newEnvironments.map((env) => (
                    <CommandItem
                      key={env.id}
                      value={env.name}
                      onSelect={() => appendEnv({ id: env.id })}
                      className="cursor-pointer"
                    >
                      {env.name}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          type="submit"
          disabled={update.isPending || !form.formState.isDirty}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};
