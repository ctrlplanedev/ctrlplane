import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useResource } from "./ResourceProvider";

function useVariables() {
  const { workspace } = useWorkspace();
  const { resource } = useResource();
  const { identifier } = resource;

  const { data: variables, isLoading } = trpc.resource.variables.useQuery({
    workspaceId: workspace.id,
    resourceIdentifier: identifier,
  });

  return { variables: variables ?? [], isLoading };
}

function Value({ value }: { value: WorkspaceEngine["schemas"]["Value"] }) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return <span className="text-green-700">{`${value}`}</span>;
  if (typeof value === "object")
    return (
      <pre className="text-green-700">{JSON.stringify(value, null, 2)}</pre>
    );
  if ("valueHash" in value)
    return <span className="text-green-700">*****</span>;
  return null;
}

function useSetVariable() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.id;
  const { resource } = useResource();
  const resourceId = resource.id;
  const resourceIdentifier = resource.identifier;

  const { mutateAsync, isPending } = trpc.resource.setVariable.useMutation();
  const utils = trpc.useUtils();

  const invalidate = () =>
    utils.resource.variables.invalidate({ workspaceId, resourceIdentifier });

  const setVariable = (
    key: string,
    value: string | number | boolean | Record<string, unknown>,
  ) =>
    mutateAsync({ workspaceId, resourceId, key, value })
      .then(() => toast.success("Variable queued successfully"))
      .then(invalidate);

  return { setVariable, isPending };
}

function SetVariableDialog() {
  const { setVariable, isPending } = useSetVariable();

  const form = useForm({
    resolver: zodResolver(
      z.object({
        key: z.string().min(1),
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.record(z.string(), z.unknown()),
        ]),
      }),
    ),
    defaultValues: { key: "", value: "" },
  });

  const onSubmit = form.handleSubmit(({ key, value }) =>
    setVariable(key, value),
  );
  const key = form.watch("key");
  const value = form.watch("value");

  const isDisabled = isPending || key === "" || value === "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Plus size={16} />
          Add Variable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Variable</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
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
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isDisabled}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceVariables() {
  const { variables } = useVariables();

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Variables</CardTitle>
        <SetVariableDialog />
      </CardHeader>

      <CardContent>
        {variables.length === 0 && (
          <p className="text-sm text-muted-foreground">No variables</p>
        )}
        {variables.length > 0 &&
          variables
            .sort((a, b) => a.key.localeCompare(b.key))
            .map(({ key, value }) => (
              <div
                key={key}
                className="flex items-start gap-2 font-mono text-xs font-semibold"
              >
                <span className="shrink-0 text-red-600">{key}:</span>
                <Value value={value} />
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
