import type { DeploymentVariable } from "@ctrlplane/db/schema";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconInfoCircle } from "@tabler/icons-react";
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
import { Switch } from "@ctrlplane/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@ctrlplane/ui/tooltip";

import {
  VariableBooleanInput,
  VariableChoiceSelect,
  VariableStringInput,
} from "~/app/[workspaceSlug]/systems/[systemSlug]/_components/variables/VariableInputs";
import { api } from "~/trpc/react";

const schema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  default: z.boolean(),
});

export const AddVariableValueDialog: React.FC<{
  variable: DeploymentVariable;
  children?: React.ReactNode;
}> = ({ children, variable }) => {
  const [open, setOpen] = useState(false);

  const create = api.deployment.variable.value.create.useMutation();
  const router = useRouter();
  const form = useForm({
    schema,
    defaultValues: { value: "", default: false },
  });
  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync({ ...values, variableId: variable.id });
    router.refresh();
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

            <div className="space-y-5">
              <FormField
                control={form.control}
                name="value"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormLabel>Value</FormLabel>
                    <FormControl>
                      <>
                        {variable.config?.type === "string" && (
                          <VariableStringInput
                            {...variable.config}
                            value={String(value)}
                            onChange={onChange}
                          />
                        )}
                        {variable.config?.type === "choice" && (
                          <VariableChoiceSelect
                            {...variable.config}
                            value={String(value)}
                            onSelect={onChange}
                          />
                        )}
                        {variable.config?.type === "boolean" && (
                          <VariableBooleanInput
                            value={value === "" ? null : Boolean(value)}
                            onChange={onChange}
                          />
                        )}
                        {variable.config?.type === "number" && (
                          <Input
                            type="number"
                            value={Number(value)}
                            onChange={(e) => onChange(e.target.valueAsNumber)}
                          />
                        )}
                      </>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default"
                render={({ field: { value, onChange } }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        <FormLabel className="flex items-center gap-1">
                          Default
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="text-muted-foreground">
                                A default value will match all targets in the
                                system that are not matched by other values.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <Switch checked={value} onCheckedChange={onChange} />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

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
