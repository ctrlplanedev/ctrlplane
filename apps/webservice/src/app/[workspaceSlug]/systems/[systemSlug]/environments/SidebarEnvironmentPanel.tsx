"use client";

import { useParams } from "next/navigation";
import { IconInfoCircle, IconPlant } from "@tabler/icons-react";
import { useReactFlow } from "reactflow";
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
import { Label } from "@ctrlplane/ui/label";
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";
import { targetCondition } from "@ctrlplane/validators/targets";

import { api } from "~/trpc/react";
import { TargetConditionDialog } from "../../../_components/target-condition/TargetConditionDialog";
import { usePanel } from "./SidepanelContext";

const environmentForm = z.object({
  name: z.string(),
  description: z.string().default(""),
  targetFilter: targetCondition.optional(),
});

export const SidebarEnvironmentPanel: React.FC = () => {
  const { getNode, setNodes } = useReactFlow();
  const { selectedNodeId } = usePanel();
  const node = getNode(selectedNodeId ?? "")!;
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const form = useForm({
    schema: environmentForm,
    defaultValues: {
      name: node.data.label,
      description: node.data.description,
      targetFilter: node.data.targetFilter,
    },
  });

  const { targetFilter } = form.watch();
  console.log({ tfForm: targetFilter });

  const targets = api.target.byWorkspaceId.list.useQuery(
    {
      workspaceId: workspace.data?.id ?? "",
      filter: targetFilter,
    },
    { enabled: workspace.data != null && targetFilter != null },
  );

  console.log({ targets: targets.data });

  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((values) => {
    setNodes((nodes) => {
      const node = nodes.find((n) => n.id === selectedNodeId);
      if (!node) return nodes;
      update
        .mutateAsync({
          id: node.id,
          data: {
            ...values,
            targetFilter,
          },
        })
        .then(() =>
          utils.environment.bySystemId.invalidate(node.data.systemId),
        );
      return nodes.map((n) =>
        n.id === selectedNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                ...values,
                targetFilter,
                label: values.name,
              },
            }
          : n,
      );
    });
  });

  return (
    <Form {...form}>
      <h2 className="flex items-center gap-4 p-6 text-2xl font-semibold">
        <div className="flex-shrink-0 rounded bg-green-500/20 p-1 text-green-400">
          <IconPlant className="h-4 w-4" />
        </div>
        <span className="flex-grow">Environment</span>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-neutral-500 hover:text-white"
        >
          <IconInfoCircle className="h-4 w-4" />
        </Button>
      </h2>
      <Separator />
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Staging, Production, QA..." {...field} />
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
                <Textarea placeholder="Add a description..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <Label></Label>

        <FormField
          control={form.control}
          name="targetFilter"
          render={({ field: { onChange, value } }) => (
            <FormItem>
              <FormControl>
                <div className="flex flex-col gap-2">
                  <FormLabel>
                    Target Filter (
                    {targetFilter != null && targets.data != null
                      ? targets.data.total
                      : "-"}
                    )
                  </FormLabel>
                  <span className="text-sm text-muted-foreground">
                    Add a filter to select targets for this environment.
                  </span>
                  <TargetConditionDialog condition={value} onChange={onChange}>
                    <Button variant="outline" className="w-fit">
                      Set targets
                    </Button>
                  </TargetConditionDialog>
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        {/* <div className="flex flex-col gap-2">
          <Label>Target Filter ({targets.data?.total ?? "-"})</Label>

          {fields.length > 1 && (
            <FormField
              control={form.control}
              name="operator"
              render={({ field: { onChange, value } }) => (
                <FormItem className="w-24">
                  <FormControl>
                    <Select onValueChange={onChange} value={value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">And</SelectItem>
                        <SelectItem value="or">Or</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`targetFilter.${index}`}
              render={({ field: { onChange, value } }) => (
                <FormItem>
                  <FormControl className="w-fit">
                    <MetadataFilterInput
                      value={value}
                      onChange={onChange}
                      onRemove={() => remove(index)}
                      workspaceId={workspace.data?.id}
                      selectedKeys={fields
                        .map((f) => f.operator !== "null" && f.value)
                        .filter((f) => f !== false)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={() =>
              append({
                key: "",
                value: "",
                type: "metadata",
                operator: "equals" as const,
              })
            }
          >
            Add Metadata Filter
          </Button>
        </div> */}

        <div className="flex gap-2">
          <Button type="submit" disabled={update.isPending}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              selectedNodeId != null && envOverride.mutate(selectedNodeId)
            }
          >
            Override
          </Button>
        </div>
      </form>
    </Form>
  );
};
